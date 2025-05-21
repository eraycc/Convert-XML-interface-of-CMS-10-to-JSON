// 配置
const proxySwitch = true; // 是否使用代理
const proxyUrl = 'https://yourproxyurl/'; // 代理地址
const proxyUrlEncode = false; // 代理是否支持URL编码

// 常见浏览器 UA
const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 14_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (iPad; CPU OS 14_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.105 Mobile Safari/537.36",
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36",
];

// 日志函数 (使用console.log)
function writeLog(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
}

// 辅助函数：提取CDATA和普通文本
function getCdataValue(node) {
    if (!node) return '';
    
    // 转换为字符串
    let value = node.textContent || node;
    
    // 去除可能的CDATA标记
    value = value.replace(/<!\[CDATA\[|\]\]>/g, '');
    
    return value.trim();
}

// 简单拼音转换函数
function pinyinConvert(text) {
    // 这是一个非常简化的拼音转换，仅作示例
    // 实际应用可能需要更复杂的拼音库
    text = text.trim();
    if (!text) return '';
    
    const firstChar = text[0];
    
    // 简单替换一些常见汉字的首字母，实际应用需要完整的拼音库
    const pinyinMap = {
        '自': 'zi',
        '己': 'ji',
        '搞': 'gao',
    };
    
    if (pinyinMap[firstChar]) {
        return pinyinMap[firstChar] + text.slice(1).replace(/\s/g, '');
    }
    
    // 如果是英文，直接返回小写
    if (/^[a-zA-Z]/.test(text)) {
        return text.toLowerCase().replace(/\s/g, '');
    }
    
    // 默认返回
    return 'shipin';
}

// 解析XML并转换为JSON
async function parseXmlResponse(responseText, params) {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(responseText, "text/xml");
        
        // 检查是否有解析错误
        const parserErrors = xmlDoc.getElementsByTagName("parsererror");
        if (parserErrors.length > 0) {
            const errorMsg = `XML Parse Error: ${parserErrors[0].textContent}`;
            writeLog(errorMsg);
            writeLog(`Response content: ${responseText.substring(0, 500)}...`);
            return {
                code: -1,
                msg: errorMsg
            };
        }
        
        const ac = params.ac || '';
        let json = {};
        
        switch (ac) {
            case 'videolist':
                json = await processVideoList(xmlDoc);
                break;
                
            case 'list':
                json = await processList(xmlDoc);
                break;
                
            case 'detail':
                json = await processDetail(xmlDoc);
                break;
                
            default:
                json = {
                    code: 0,
                    msg: "无效的请求"
                };
                break;
        }
        
        return json;
        
    } catch (e) {
        writeLog(`Exception: ${e.message}`);
        return {
            code: -1,
            msg: `处理错误: ${e.message}`
        };
    }
}

async function processVideoList(xmlDoc) {
    const list = xmlDoc.querySelector('list');
    const videos = xmlDoc.querySelectorAll('list video');
    
    const videoList = [];
    
    for (const video of videos) {
        const name = getCdataValue(video.querySelector('name'));
        
        // 处理播放源
        let playFrom = '';
        const dt = video.querySelector('dt');
        if (dt) {
            playFrom = getCdataValue(dt);
        } else {
            const dd = video.querySelector('dl dd');
            if (dd && dd.getAttribute('flag')) {
                playFrom = dd.getAttribute('flag');
            }
        }
        
        // 处理播放URL
        let playUrl = '';
        const dd = video.querySelector('dl dd');
        if (dd) {
            playUrl = getCdataValue(dd);
        }
        
        // 处理名称首字母
        let firstLetter = '';
        if (name) {
            // 在Worker环境中，我们简化首字母处理
            firstLetter = name[0].toUpperCase();
            if (!/[A-Z]/.test(firstLetter)) {
                firstLetter = 'X'; // 默认首字母
            }
        }
        
        videoList.push({
            vod_id: parseInt(video.querySelector('id')?.textContent || '0'),
            type_id: parseInt(video.querySelector('tid')?.textContent || '0'),
            type_id_1: 2,
            group_id: 0,
            vod_name: name,
            vod_sub: getCdataValue(video.querySelector('des')),
            vod_en: pinyinConvert(name),
            vod_status: 1,
            vod_letter: firstLetter,
            vod_color: "",
            vod_tag: "",
            vod_class: "",
            vod_pic: getCdataValue(video.querySelector('pic')),
            vod_pic_thumb: "",
            vod_pic_slide: "",
            vod_pic_screenshot: "",
            vod_actor: getCdataValue(video.querySelector('actor')),
            vod_director: getCdataValue(video.querySelector('director')),
            vod_writer: "",
            vod_behind: "",
            vod_blurb: getCdataValue(video.querySelector('des')),
            vod_remarks: getCdataValue(video.querySelector('note')),
            vod_pubdate: getCdataValue(video.querySelector('year')),
            vod_total: 0,
            vod_serial: "0",
            vod_tv: "",
            vod_weekday: "",
            vod_area: getCdataValue(video.querySelector('area')),
            vod_lang: getCdataValue(video.querySelector('lang')),
            vod_year: getCdataValue(video.querySelector('year')),
            vod_version: "",
            vod_state: getCdataValue(video.querySelector('state')),
            vod_author: "",
            vod_jumpurl: "",
            vod_tpl: "",
            vod_tpl_play: "",
            vod_tpl_down: "",
            vod_isend: 0,
            vod_lock: 0,
            vod_level: 0,
            vod_copyright: 0,
            vod_points: 0,
            vod_points_play: 0,
            vod_points_down: 0,
            vod_hits: 581,
            vod_hits_day: 939,
            vod_hits_week: 83,
            vod_hits_month: 137,
            vod_duration: "",
            vod_up: 512,
            vod_down: 838,
            vod_score: "6.0",
            vod_score_all: 7280,
            vod_score_num: 728,
            vod_time: getCdataValue(video.querySelector('last')),
            vod_time_add: Math.floor(Date.now() / 1000),
            vod_time_hits: 0,
            vod_time_make: 0,
            vod_trysee: 0,
            vod_douban_id: 36427183,
            vod_douban_score: "0.0",
            vod_reurl: "",
            vod_rel_vod: "",
            vod_rel_art: "",
            vod_pwd: "",
            vod_pwd_url: "",
            vod_pwd_play: "",
            vod_pwd_play_url: "",
            vod_pwd_down: "",
            vod_pwd_down_url: "",
            vod_content: getCdataValue(video.querySelector('des')),
            vod_play_from: playFrom,
            vod_play_server: "",
            vod_play_note: "",
            vod_play_url: playUrl,
            vod_down_from: "",
            vod_down_server: "",
            vod_down_note: "",
            vod_down_url: "",
            vod_plot: 0,
            vod_plot_name: "",
            vod_plot_detail: "",
            type_name: getCdataValue(video.querySelector('type'))
        });
    }
    
    return {
        code: 1,
        msg: "数据列表",
        page: list?.getAttribute('page') || "1",
        pagecount: parseInt(list?.getAttribute('pagecount') || "1"),
        limit: list?.getAttribute('pagesize') || "20",
        total: parseInt(list?.getAttribute('recordcount') || "0"),
        list: videoList
    };
}

async function processList(xmlDoc) {
    const list = xmlDoc.querySelector('list');
    const videos = xmlDoc.querySelectorAll('list video');
    const types = xmlDoc.querySelectorAll('class ty');
    
    const videoList = [];
    const typeList = [];
    
    for (const video of videos) {
        const name = getCdataValue(video.querySelector('name'));
        
        videoList.push({
            vod_id: parseInt(video.querySelector('id')?.textContent || '0'),
            vod_name: name,
            type_id: parseInt(video.querySelector('tid')?.textContent || '0'),
            type_name: getCdataValue(video.querySelector('type')),
            vod_en: pinyinConvert(name),
            vod_time: getCdataValue(video.querySelector('last')),
            vod_remarks: getCdataValue(video.querySelector('note')),
            vod_play_from: getCdataValue(video.querySelector('dt'))
        });
    }
    
    for (const type of types) {
        typeList.push({
            type_id: parseInt(type.getAttribute('id') || '0'),
            type_pid: 0,
            type_name: getCdataValue(type)
        });
    }
    
    return {
        code: 1,
        msg: "数据列表",
        page: list?.getAttribute('page') || "1",
        pagecount: parseInt(list?.getAttribute('pagecount') || "1"),
        limit: list?.getAttribute('pagesize') || "20",
        total: parseInt(list?.getAttribute('recordcount') || "0"),
        list: videoList,
        class: typeList
    };
}

async function processDetail(xmlDoc) {
    const list = xmlDoc.querySelector('list');
    const videos = xmlDoc.querySelectorAll('list video');
    
    const videoList = [];
    
    for (const video of videos) {
        const name = getCdataValue(video.querySelector('name'));
        
        // 处理播放源
        let playFrom = '';
        const dt = video.querySelector('dt');
        if (dt) {
            playFrom = getCdataValue(dt);
        } else {
            const dd = video.querySelector('dl dd');
            if (dd && dd.getAttribute('flag')) {
                playFrom = dd.getAttribute('flag');
            }
        }
        
        // 处理播放URL
        let playUrl = '';
        const dd = video.querySelector('dl dd');
        if (dd) {
            playUrl = getCdataValue(dd);
        }
        
        // 处理名称首字母
        let firstLetter = '';
        if (name) {
            firstLetter = name[0].toUpperCase();
            if (!/[A-Z]/.test(firstLetter)) {
                firstLetter = 'X'; // 默认首字母
            }
        }
        
        videoList.push({
            vod_id: parseInt(video.querySelector('id')?.textContent || '0'),
            type_id: parseInt(video.querySelector('tid')?.textContent || '0'),
            type_id_1: 2,
            group_id: 0,
            vod_name: name,
            vod_sub: "",
            vod_en: pinyinConvert(name),
            vod_status: 1,
            vod_letter: firstLetter,
            vod_color: "",
            vod_tag: "",
            vod_class: "",
            vod_pic: getCdataValue(video.querySelector('pic')),
            vod_pic_thumb: "",
            vod_pic_slide: "",
            vod_pic_screenshot: "",
            vod_actor: getCdataValue(video.querySelector('actor')),
            vod_director: getCdataValue(video.querySelector('director')),
            vod_writer: "",
            vod_behind: "",
            vod_blurb: getCdataValue(video.querySelector('des')),
            vod_remarks: getCdataValue(video.querySelector('note')),
            vod_pubdate: getCdataValue(video.querySelector('year')),
            vod_total: 0,
            vod_serial: "0",
            vod_tv: "",
            vod_weekday: "",
            vod_area: getCdataValue(video.querySelector('area')),
            vod_lang: getCdataValue(video.querySelector('lang')),
            vod_year: getCdataValue(video.querySelector('year')),
            vod_version: "",
            vod_state: getCdataValue(video.querySelector('state')),
            vod_author: "",
            vod_jumpurl: "",
            vod_tpl: "",
            vod_tpl_play: "",
            vod_tpl_down: "",
            vod_isend: 0,
            vod_lock: 0,
            vod_level: 0,
            vod_copyright: 0,
            vod_points: 0,
            vod_points_play: 0,
            vod_points_down: 0,
            vod_hits: 581,
            vod_hits_day: 939,
            vod_hits_week: 83,
            vod_hits_month: 137,
            vod_duration: "",
            vod_up: 512,
            vod_down: 838,
            vod_score: "6.0",
            vod_score_all: 7280,
            vod_score_num: 728,
            vod_time: getCdataValue(video.querySelector('last')),
            vod_time_add: Math.floor(Date.now() / 1000),
            vod_time_hits: 0,
            vod_time_make: 0,
            vod_trysee: 0,
            vod_douban_id: 36427183,
            vod_douban_score: "0.0",
            vod_reurl: "",
            vod_rel_vod: "",
            vod_rel_art: "",
            vod_pwd: "",
            vod_pwd_url: "",
            vod_pwd_play: "",
            vod_pwd_play_url: "",
            vod_pwd_down: "",
            vod_pwd_down_url: "",
            vod_content: getCdataValue(video.querySelector('des')),
            vod_play_from: playFrom,
            vod_play_server: "",
            vod_play_note: "",
            vod_play_url: playUrl,
            vod_down_from: "",
            vod_down_server: "",
            vod_down_note: "",
            vod_down_url: "",
            vod_plot: 0,
            vod_plot_name: "",
            vod_plot_detail: "",
            type_name: getCdataValue(video.querySelector('type'))
        });
    }
    
    return {
        code: 1,
        msg: "数据列表",
        page: 1,
        pagecount: 1,
        limit: "20",
        total: 1,
        list: videoList
    };
}

async function handleRequest(request) {
    try {
        const url = new URL(request.url);
        const params = Object.fromEntries(url.searchParams.entries());
        
        // 获取请求参数
        const apiUrl = params.apiurl ? decodeURIComponent(params.apiurl) : '';
        delete params.apiurl; // 移除 apiurl 参数
        
        if (!apiUrl) {
            return new Response(JSON.stringify({
                code: -1,
                msg: "缺少apiurl参数"
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 构造请求地址
        let requestUrl;
        if (proxySwitch) {
            requestUrl = proxyUrlEncode ? proxyUrl + encodeURIComponent(apiUrl) : proxyUrl + apiUrl;
        } else {
            requestUrl = apiUrl;
        }
        
        // 添加其他参数
        const queryString = new URLSearchParams(params).toString();
        if (queryString) {
            requestUrl += '?' + queryString;
        }
        
        // 随机选择一个 UA
        const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
        
        // 发起请求
        const response = await fetch(requestUrl, {
            headers: {
                'User-Agent': userAgent
            },
            cf: {
                cacheEverything: false,
                cacheTtl: 0
            }
        });
        
        if (!response.ok) {
            const errorMsg = `请求失败: ${response.status} ${response.statusText}`;
            writeLog(errorMsg);
            return new Response(JSON.stringify({
                code: -1,
                msg: errorMsg
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const responseText = await response.text();
        
        if (!responseText) {
            writeLog("Empty response from API");
            return new Response(JSON.stringify({
                code: -1,
                msg: "Empty response from API"
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 解析XML并转换为JSON
        const jsonResponse = await parseXmlResponse(responseText, params);
        
        return new Response(JSON.stringify(jsonResponse, null, 2), {
            headers: { 'Content-Type': 'application/json' }
        });
        
    } catch (error) {
        writeLog(`处理请求时出错: ${error.message}`);
        return new Response(JSON.stringify({
            code: -1,
            msg: `处理请求时出错: ${error.message}`
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});
