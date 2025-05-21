<?php

// 配置
$proxySwitch = true; // 是否使用代理
$proxyUrl = 'https://yourproxyurl/'; // 代理地址
$proxyUrlEncode = false; // 代理是否支持URL编码

// 日志函数
function writeLog($message) {
    $logFile = __DIR__ . '/debug.log';
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents($logFile, "[$timestamp] $message\n", FILE_APPEND);
}

// 常见浏览器 UA
$userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 14_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (iPad; CPU OS 14_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.105 Mobile Safari/537.36",
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36",
];

// 获取请求参数
$apiUrl = isset($_GET['apiurl']) ? urldecode($_GET['apiurl']) : '';
$params = $_GET;
unset($params['apiurl']); // 移除 apiurl 参数

// 构造请求地址
if ($proxySwitch) {
    $requestUrl = $proxyUrlEncode ? $proxyUrl . urlencode($apiUrl) : $proxyUrl . $apiUrl;
} else {
    $requestUrl = $apiUrl;
}

// 随机选择一个 UA
$userAgent = $userAgents[array_rand($userAgents)];

// 初始化 CURL 请求
$curl = curl_init();
curl_setopt($curl, CURLOPT_URL, $requestUrl . '?' . http_build_query($params));
curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
curl_setopt($curl, CURLOPT_USERAGENT, $userAgent);
curl_setopt($curl, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($curl, CURLOPT_TIMEOUT, 30);
curl_setopt($curl, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($curl, CURLOPT_SSL_VERIFYHOST, false);

$response = curl_exec($curl);
$error = curl_error($curl);
$info = curl_getinfo($curl);
curl_close($curl);

if ($error) {
    writeLog("CURL Error: " . $error);
    header('Content-Type: application/json');
    echo json_encode([
        "code" => -1,
        "msg" => "CURL Error: " . $error
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if (empty($response)) {
    writeLog("Empty response from API");
    header('Content-Type: application/json');
    echo json_encode([
        "code" => -1,
        "msg" => "Empty response from API"
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 解析 XML
libxml_use_internal_errors(true);
$xml = simplexml_load_string($response);

if ($xml === false) {
    $errors = libxml_get_errors();
    $errorMsg = "XML Parse Error: ";
    foreach ($errors as $error) {
        $errorMsg .= $error->message . " (Line: {$error->line}) ";
    }
    libxml_clear_errors();
    
    writeLog($errorMsg);
    writeLog("Response content: " . substr($response, 0, 500) . "...");
    
    header('Content-Type: application/json');
    echo json_encode([
        "code" => -1,
        "msg" => $errorMsg
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 辅助函数：提取CDATA和普通文本
function getCdataValue($node) {
    if ($node === null) return '';
    
    // 转换为字符串，SimpleXML会自动处理CDATA
    $value = (string)$node;
    
    // 去除可能的CDATA标记（以防万一）
    $value = str_replace(['<![CDATA[', ']]>'], '', $value);
    
    return trim($value);
}

// 根据 ac 参数处理不同的返回格式
$ac = isset($params['ac']) ? $params['ac'] : '';

try {
    $json = [];
    
    switch ($ac) {
        case 'videolist':
            $json = [
                "code" => 1,
                "msg" => "数据列表",
                "page" => (string)$xml->list['page'],
                "pagecount" => (int)$xml->list['pagecount'],
                "limit" => (string)$xml->list['pagesize'],
                "total" => (int)$xml->list['recordcount'],
                "list" => []
            ];

            if (isset($xml->list->video)) {
                foreach ($xml->list->video as $video) {
                    $playFrom = '';
                    $playUrl = '';
                    
                    // 处理播放源
                    if (isset($video->dt)) {
                        $playFrom = getCdataValue($video->dt);
                    } elseif (isset($video->dl->dd['flag'])) {
                        $playFrom = (string)$video->dl->dd['flag'];
                    }
                    
                    // 处理播放URL
                    if (isset($video->dl->dd)) {
                        $playUrl = getCdataValue($video->dl->dd);
                    }
                    
                    // 处理名称首字母
                    $name = getCdataValue($video->name);
                    $firstLetter = '';
                    if (!empty($name)) {
                        $firstChar = mb_substr($name, 0, 1, 'UTF-8');
                        $firstLetter = strtoupper(substr(iconv('UTF-8', 'GBK//IGNORE', $firstChar), 0, 1));
                        if (!preg_match('/[A-Z]/', $firstLetter)) {
                            $firstLetter = 'X'; // 默认首字母
                        }
                    }
                    
                    // 构建视频条目
                    $item = [
                        "vod_id" => (int)$video->id,
                        "type_id" => (int)$video->tid,
                        "type_id_1" => 2,
                        "group_id" => 0,
                        "vod_name" => $name,
                        "vod_sub" => getCdataValue($video->des),
                        "vod_en" => pinyin_convert($name),
                        "vod_status" => 1,
                        "vod_letter" => $firstLetter,
                        "vod_color" => "",
                        "vod_tag" => "",
                        "vod_class" => "",
                        "vod_pic" => getCdataValue($video->pic),
                        "vod_pic_thumb" => "",
                        "vod_pic_slide" => "",
                        "vod_pic_screenshot" => "",
                        "vod_actor" => getCdataValue($video->actor),
                        "vod_director" => getCdataValue($video->director),
                        "vod_writer" => "",
                        "vod_behind" => "",
                        "vod_blurb" => getCdataValue($video->des),
                        "vod_remarks" => getCdataValue($video->note),
                        "vod_pubdate" => getCdataValue($video->year),
                        "vod_total" => 0,
                        "vod_serial" => "0",
                        "vod_tv" => "",
                        "vod_weekday" => "",
                        "vod_area" => getCdataValue($video->area),
                        "vod_lang" => getCdataValue($video->lang),
                        "vod_year" => getCdataValue($video->year),
                        "vod_version" => "",
                        "vod_state" => getCdataValue($video->state),
                        "vod_author" => "",
                        "vod_jumpurl" => "",
                        "vod_tpl" => "",
                        "vod_tpl_play" => "",
                        "vod_tpl_down" => "",
                        "vod_isend" => 0,
                        "vod_lock" => 0,
                        "vod_level" => 0,
                        "vod_copyright" => 0,
                        "vod_points" => 0,
                        "vod_points_play" => 0,
                        "vod_points_down" => 0,
                        "vod_hits" => 581,
                        "vod_hits_day" => 939,
                        "vod_hits_week" => 83,
                        "vod_hits_month" => 137,
                        "vod_duration" => "",
                        "vod_up" => 512,
                        "vod_down" => 838,
                        "vod_score" => "6.0",
                        "vod_score_all" => 7280,
                        "vod_score_num" => 728,
                        "vod_time" => getCdataValue($video->last),
                        "vod_time_add" => time(),
                        "vod_time_hits" => 0,
                        "vod_time_make" => 0,
                        "vod_trysee" => 0,
                        "vod_douban_id" => 36427183,
                        "vod_douban_score" => "0.0",
                        "vod_reurl" => "",
                        "vod_rel_vod" => "",
                        "vod_rel_art" => "",
                        "vod_pwd" => "",
                        "vod_pwd_url" => "",
                        "vod_pwd_play" => "",
                        "vod_pwd_play_url" => "",
                        "vod_pwd_down" => "",
                        "vod_pwd_down_url" => "",
                        "vod_content" => getCdataValue($video->des),
                        "vod_play_from" => $playFrom,
                        "vod_play_server" => "",
                        "vod_play_note" => "",
                        "vod_play_url" => $playUrl,
                        "vod_down_from" => "",
                        "vod_down_server" => "",
                        "vod_down_note" => "",
                        "vod_down_url" => "",
                        "vod_plot" => 0,
                        "vod_plot_name" => "",
                        "vod_plot_detail" => "",
                        "type_name" => getCdataValue($video->type)
                    ];
                    
                    $json['list'][] = $item;
                }
            }
            break;

        case 'list':
            $json = [
                "code" => 1,
                "msg" => "数据列表",
                "page" => (string)$xml->list['page'],
                "pagecount" => (int)$xml->list['pagecount'],
                "limit" => (string)$xml->list['pagesize'],
                "total" => (int)$xml->list['recordcount'],
                "list" => [],
                "class" => []
            ];

            if (isset($xml->list->video)) {
                foreach ($xml->list->video as $video) {
                    $name = getCdataValue($video->name);
                    $json['list'][] = [
                        "vod_id" => (int)$video->id,
                        "vod_name" => $name,
                        "type_id" => (int)$video->tid,
                        "type_name" => getCdataValue($video->type),
                        "vod_en" => pinyin_convert($name),
                        "vod_time" => getCdataValue($video->last),
                        "vod_remarks" => getCdataValue($video->note),
                        "vod_play_from" => getCdataValue($video->dt)
                    ];
                }
            }

            if (isset($xml->class->ty)) {
                foreach ($xml->class->ty as $type) {
                    $json['class'][] = [
                        "type_id" => (int)$type['id'],
                        "type_pid" => 0,
                        "type_name" => getCdataValue($type)
                    ];
                }
            }
            break;

        case 'detail':
            $json = [
                "code" => 1,
                "msg" => "数据列表",
                "page" => 1,
                "pagecount" => 1,
                "limit" => "20",
                "total" => 1,
                "list" => []
            ];

            if (isset($xml->list->video)) {
                foreach ($xml->list->video as $video) {
                    $playFrom = '';
                    $playUrl = '';
                    
                    // 处理播放源
                    if (isset($video->dt)) {
                        $playFrom = getCdataValue($video->dt);
                    } elseif (isset($video->dl->dd['flag'])) {
                        $playFrom = (string)$video->dl->dd['flag'];
                    }
                    
                    // 处理播放URL
                    if (isset($video->dl->dd)) {
                        $playUrl = getCdataValue($video->dl->dd);
                    }
                    
                    // 处理名称首字母
                    $name = getCdataValue($video->name);
                    $firstLetter = '';
                    if (!empty($name)) {
                        $firstChar = mb_substr($name, 0, 1, 'UTF-8');
                        $firstLetter = strtoupper(substr(iconv('UTF-8', 'GBK//IGNORE', $firstChar), 0, 1));
                        if (!preg_match('/[A-Z]/', $firstLetter)) {
                            $firstLetter = 'X'; // 默认首字母
                        }
                    }
                    
                    // 构建视频条目
                    $item = [
                        "vod_id" => (int)$video->id,
                        "type_id" => (int)$video->tid,
                        "type_id_1" => 2,
                        "group_id" => 0,
                        "vod_name" => $name,
                        "vod_sub" => "",
                        "vod_en" => pinyin_convert($name),
                        "vod_status" => 1,
                        "vod_letter" => $firstLetter,
                        "vod_color" => "",
                        "vod_tag" => "",
                        "vod_class" => "",
                        "vod_pic" => getCdataValue($video->pic),
                        "vod_pic_thumb" => "",
                        "vod_pic_slide" => "",
                        "vod_pic_screenshot" => "",
                        "vod_actor" => getCdataValue($video->actor),
                        "vod_director" => getCdataValue($video->director),
                        "vod_writer" => "",
                        "vod_behind" => "",
                        "vod_blurb" => getCdataValue($video->des),
                        "vod_remarks" => getCdataValue($video->note),
                        "vod_pubdate" => getCdataValue($video->year),
                        "vod_total" => 0,
                        "vod_serial" => "0",
                        "vod_tv" => "",
                        "vod_weekday" => "",
                        "vod_area" => getCdataValue($video->area),
                        "vod_lang" => getCdataValue($video->lang),
                        "vod_year" => getCdataValue($video->year),
                        "vod_version" => "",
                        "vod_state" => getCdataValue($video->state),
                        "vod_author" => "",
                        "vod_jumpurl" => "",
                        "vod_tpl" => "",
                        "vod_tpl_play" => "",
                        "vod_tpl_down" => "",
                        "vod_isend" => 0,
                        "vod_lock" => 0,
                        "vod_level" => 0,
                        "vod_copyright" => 0,
                        "vod_points" => 0,
                        "vod_points_play" => 0,
                        "vod_points_down" => 0,
                        "vod_hits" => 581,
                        "vod_hits_day" => 939,
                        "vod_hits_week" => 83,
                        "vod_hits_month" => 137,
                        "vod_duration" => "",
                        "vod_up" => 512,
                        "vod_down" => 838,
                        "vod_score" => "6.0",
                        "vod_score_all" => 7280,
                        "vod_score_num" => 728,
                        "vod_time" => getCdataValue($video->last),
                        "vod_time_add" => time(),
                        "vod_time_hits" => 0,
                        "vod_time_make" => 0,
                        "vod_trysee" => 0,
                        "vod_douban_id" => 36427183,
                        "vod_douban_score" => "0.0",
                        "vod_reurl" => "",
                        "vod_rel_vod" => "",
                        "vod_rel_art" => "",
                        "vod_pwd" => "",
                        "vod_pwd_url" => "",
                        "vod_pwd_play" => "",
                        "vod_pwd_play_url" => "",
                        "vod_pwd_down" => "",
                        "vod_pwd_down_url" => "",
                        "vod_content" => getCdataValue($video->des),
                        "vod_play_from" => $playFrom,
                        "vod_play_server" => "",
                        "vod_play_note" => "",
                        "vod_play_url" => $playUrl,
                        "vod_down_from" => "",
                        "vod_down_server" => "",
                        "vod_down_note" => "",
                        "vod_down_url" => "",
                        "vod_plot" => 0,
                        "vod_plot_name" => "",
                        "vod_plot_detail" => "",
                        "type_name" => getCdataValue($video->type)
                    ];
                    
                    $json['list'][] = $item;
                }
            }
            break;

        default:
            $json = [
                "code" => 0,
                "msg" => "无效的请求"
            ];
            break;
    }

    // 返回 JSON 格式的数据
    header('Content-Type: application/json');
    echo json_encode($json, JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    writeLog("Exception: " . $e->getMessage());
    header('Content-Type: application/json');
    echo json_encode([
        "code" => -1,
        "msg" => "处理错误: " . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}

// 简单拼音转换函数
function pinyin_convert($text) {
    // 这是一个非常简化的拼音转换，仅作示例
    // 实际应用可能需要更复杂的拼音库
    $text = trim($text);
    if (empty($text)) return '';
    
    $firstChar = mb_substr($text, 0, 1, 'UTF-8');
    
    // 简单替换一些常见汉字的首字母，实际应用需要完整的拼音库
    $pinyinMap = [
        '自' => 'zi',
        '己' => 'ji',
        '搞' => 'gao',
    ];
    
    if (isset($pinyinMap[$firstChar])) {
        return $pinyinMap[$firstChar] . mb_substr(str_replace(' ', '', $text), 1, null, 'UTF-8');
    }
    
    // 如果是英文，直接返回小写
    if (preg_match('/^[a-zA-Z]/', $text)) {
        return strtolower(str_replace(' ', '', $text));
    }
    
    // 默认返回
    return 'shipin';
}
?>
