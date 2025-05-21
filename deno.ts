// 导入 xml-js 用于 XML 解析
import { xml2js } from "https://deno.land/x/xml2js@1.0.0/mod.ts";

// 配置
const proxySwitch = false; // 是否使用代理
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

// 辅助函数：提取CDATA和普通文本
function getCdataValue(node: any): string {
    if (!node) return '';
    
    if (typeof node === 'string') {
        return node.trim();
    }
    
    if (node._text) {
        return node._text.trim();
    }
    
    if (node._cdata) {
        return node._cdata.trim();
    }
    
    return '';
}

// 简单拼音转换函数
function pinyinConvert(text: string): string {
    text = text.trim();
    if (!text) return '';
    
    const firstChar = text[0];
    
    const pinyinMap: Record<string, string> = {
        '自': 'zi',
        '己': 'ji',
        '搞': 'gao',
    };
    
    if (pinyinMap[firstChar]) {
        return pinyinMap[firstChar] + text.slice(1).replace(/\s+/g, '');
    }
    
    if (/^[a-zA-Z]/.test(text)) {
        return text.replace(/\s+/g, '').toLowerCase();
    }
    
    return 'shipin';
}

// XML解析函数
async function parseXml(xmlString: string): Promise<any> {
    try {
        const result = await xml2js(xmlString, { 
            compact: true,
            ignoreDeclaration: true,
            ignoreInstruction: true,
            ignoreAttributes: false,
            ignoreComment: true,
            ignoreDoctype: true
        });
        
        return result;
    } catch (error) {
        throw new Error(`XML Parse Error: ${error.message}`);
    }
}

// 获取节点属性值
function getAttributeValue(node: any, attrName: string): string {
    if (!node || !node._attributes) return '';
    return node._attributes[attrName] || '';
}

// 处理请求
async function handleRequest(request: Request): Promise<Response> {
    try {
        const url = new URL(request.url);
        const params = Object.fromEntries(url.searchParams.entries());
        
        const apiUrl = params.apiurl ? decodeURIComponent(params.apiurl) : '';
        delete params.apiurl;

        // 构造请求地址
        let requestUrl = '';
        if (proxySwitch) {
            requestUrl = proxyUrlEncode ? proxyUrl + encodeURIComponent(apiUrl) : proxyUrl + apiUrl;
        } else {
            requestUrl = apiUrl;
        }

        // 添加参数
        const queryString = new URLSearchParams(params).toString();
        const fullUrl = requestUrl + (queryString ? `?${queryString}` : '');

        // 随机选择一个 UA
        const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

        // 发起请求
        console.log(`Making request to: ${fullUrl}`);
        const response = await fetch(fullUrl, {
            headers: {
                'User-Agent': userAgent
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const responseText = await response.text();
        
        if (!responseText) {
            console.log("Empty response from API");
            return new Response(JSON.stringify({
                "code": -1,
                "msg": "Empty response from API"
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 解析 XML
        let xmlData;
        try {
            xmlData = await parseXml(responseText);
        } catch (error) {
            console.log(`XML Parse Error: ${error.message}`);
            console.log(`Response content: ${responseText.substring(0, 500)}...`);
            
            return new Response(JSON.stringify({
                "code": -1,
                "msg": `XML Parse Error: ${error.message}`
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 根据 ac 参数处理不同的返回格式
        const ac = params.ac || '';

        let jsonResponse;
        
        switch (ac) {
            case 'videolist':
                jsonResponse = await processVideoList(xmlData);
                break;
            case 'list':
                jsonResponse = await processList(xmlData);
                break;
            case 'detail':
                jsonResponse = await processDetail(xmlData);
                break;
            default:
                jsonResponse = {
                    "code": 0,
                    "msg": "无效的请求"
                };
                break;
        }

        return new Response(JSON.stringify(jsonResponse), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.log(`Error: ${error.message}`);
        return new Response(JSON.stringify({
            "code": -1,
            "msg": `处理错误: ${error.message}`
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function processVideoList(xmlData: any): Promise<any> {
    const list = xmlData.list;
    const videos = Array.isArray(list.video) ? list.video : [list.video];
    
    const result = {
        "code": 1,
        "msg": "数据列表",
        "page": getAttributeValue(list, 'page') || "1",
        "pagecount": parseInt(getAttributeValue(list, 'pagecount') || "0"),
        "limit": getAttributeValue(list, 'pagesize') || "20",
        "total": parseInt(getAttributeValue(list, 'recordcount') || "0"),
        "list": [] as any[]
    };

    for (const video of videos) {
        const name = getCdataValue(video.name);
        const dt = video.dt;
        const dl = video.dl;
        
        let playFrom = '';
        let playUrl = '';
        
        if (dt) {
            playFrom = getCdataValue(dt);
        } else if (dl) {
            const dd = dl.dd;
            if (dd) {
                playFrom = getAttributeValue(dd, 'flag') || '';
            }
        }
        
        if (dl) {
            const dd = dl.dd;
            if (dd) {
                playUrl = getCdataValue(dd);
            }
        }
        
        let firstLetter = 'X';
        if (name) {
            firstLetter = name[0].toUpperCase();
            if (!/[A-Z]/.test(firstLetter)) {
                firstLetter = 'X';
            }
        }
        
        const item = {
            "vod_id": parseInt(getCdataValue(video.id) || "0"),
            "type_id": parseInt(getCdataValue(video.tid) || "0"),
            "type_id_1": 2,
            "group_id": 0,
            "vod_name": name,
            "vod_sub": getCdataValue(video.des),
            "vod_en": pinyinConvert(name),
            "vod_status": 1,
            "vod_letter": firstLetter,
            "vod_color": "",
            "vod_tag": "",
            "vod_class": "",
            "vod_pic": getCdataValue(video.pic),
            "vod_pic_thumb": "",
            "vod_pic_slide": "",
            "vod_pic_screenshot": "",
            "vod_actor": getCdataValue(video.actor),
            "vod_director": getCdataValue(video.director),
            "vod_writer": "",
            "vod_behind": "",
            "vod_blurb": getCdataValue(video.des),
            "vod_remarks": getCdataValue(video.note),
            "vod_pubdate": getCdataValue(video.year),
            "vod_total": 0,
            "vod_serial": "0",
            "vod_tv": "",
            "vod_weekday": "",
            "vod_area": getCdataValue(video.area),
            "vod_lang": getCdataValue(video.lang),
            "vod_year": getCdataValue(video.year),
            "vod_version": "",
            "vod_state": getCdataValue(video.state),
            "vod_author": "",
            "vod_jumpurl": "",
            "vod_tpl": "",
            "vod_tpl_play": "",
            "vod_tpl_down": "",
            "vod_isend": 0,
            "vod_lock": 0,
            "vod_level": 0,
            "vod_copyright": 0,
            "vod_points": 0,
            "vod_points_play": 0,
            "vod_points_down": 0,
            "vod_hits": 581,
            "vod_hits_day": 939,
            "vod_hits_week": 83,
            "vod_hits_month": 137,
            "vod_duration": "",
            "vod_up": 512,
            "vod_down": 838,
            "vod_score": "6.0",
            "vod_score_all": 7280,
            "vod_score_num": 728,
            "vod_time": getCdataValue(video.last),
            "vod_time_add": Math.floor(Date.now() / 1000),
            "vod_time_hits": 0,
            "vod_time_make": 0,
            "vod_trysee": 0,
            "vod_douban_id": 36427183,
            "vod_douban_score": "0.0",
            "vod_reurl": "",
            "vod_rel_vod": "",
            "vod_rel_art": "",
            "vod_pwd": "",
            "vod_pwd_url": "",
            "vod_pwd_play": "",
            "vod_pwd_play_url": "",
            "vod_pwd_down": "",
            "vod_pwd_down_url": "",
            "vod_content": getCdataValue(video.des),
            "vod_play_from": playFrom,
            "vod_play_server": "",
            "vod_play_note": "",
            "vod_play_url": playUrl,
            "vod_down_from": "",
            "vod_down_server": "",
            "vod_down_note": "",
            "vod_down_url": "",
            "vod_plot": 0,
            "vod_plot_name": "",
            "vod_plot_detail": "",
            "type_name": getCdataValue(video.type)
        };
        
        result.list.push(item);
    }
    
    return result;
}

async function processList(xmlData: any): Promise<any> {
    const list = xmlData.list;
    const videos = Array.isArray(list.video) ? list.video : [list.video];
    const classTypes = Array.isArray(xmlData.class.ty) ? xmlData.class.ty : [xmlData.class.ty];
    
    const result = {
        "code": 1,
        "msg": "数据列表",
        "page": getAttributeValue(list, 'page') || "1",
        "pagecount": parseInt(getAttributeValue(list, 'pagecount') || "0"),
        "limit": getAttributeValue(list, 'pagesize') || "20",
        "total": parseInt(getAttributeValue(list, 'recordcount') || "0"),
        "list": [] as any[],
        "class": [] as any[]
    };

    for (const video of videos) {
        const name = getCdataValue(video.name);
        result.list.push({
            "vod_id": parseInt(getCdataValue(video.id) || "0"),
            "vod_name": name,
            "type_id": parseInt(getCdataValue(video.tid) || "0"),
            "type_name": getCdataValue(video.type),
            "vod_en": pinyinConvert(name),
            "vod_time": getCdataValue(video.last),
            "vod_remarks": getCdataValue(video.note),
            "vod_play_from": getCdataValue(video.dt)
        });
    }

    for (const type of classTypes) {
        result.class.push({
            "type_id": parseInt(getAttributeValue(type, 'id') || "0"),
            "type_pid": 0,
            "type_name": getCdataValue(type)
        });
    }
    
    return result;
}

async function processDetail(xmlData: any): Promise<any> {
    const list = xmlData.list;
    const videos = Array.isArray(list.video) ? list.video : [list.video];
    
    const result = {
        "code": 1,
        "msg": "数据列表",
        "page": 1,
        "pagecount": 1,
        "limit": "20",
        "total": 1,
        "list": [] as any[]
    };

    for (const video of videos) {
        const name = getCdataValue(video.name);
        const dt = video.dt;
        const dl = video.dl;
        
        let playFrom = '';
        let playUrl = '';
        
        if (dt) {
            playFrom = getCdataValue(dt);
        } else if (dl) {
            const dd = dl.dd;
            if (dd) {
                playFrom = getAttributeValue(dd, 'flag') || '';
            }
        }
        
        if (dl) {
            const dd = dl.dd;
            if (dd) {
                playUrl = getCdataValue(dd);
            }
        }
        
        let firstLetter = 'X';
        if (name) {
            firstLetter = name[0].toUpperCase();
            if (!/[A-Z]/.test(firstLetter)) {
                firstLetter = 'X';
            }
        }
        
        const item = {
            "vod_id": parseInt(getCdataValue(video.id) || "0"),
            "type_id": parseInt(getCdataValue(video.tid) || "0"),
            "type_id_1": 2,
            "group_id": 0,
            "vod_name": name,
            "vod_sub": "",
            "vod_en": pinyinConvert(name),
            "vod_status": 1,
            "vod_letter": firstLetter,
            "vod_color": "",
            "vod_tag": "",
            "vod_class": "",
            "vod_pic": getCdataValue(video.pic),
            "vod_pic_thumb": "",
            "vod_pic_slide": "",
            "vod_pic_screenshot": "",
            "vod_actor": getCdataValue(video.actor),
            "vod_director": getCdataValue(video.director),
            "vod_writer": "",
            "vod_behind": "",
            "vod_blurb": getCdataValue(video.des),
            "vod_remarks": getCdataValue(video.note),
            "vod_pubdate": getCdataValue(video.year),
            "vod_total": 0,
            "vod_serial": "0",
            "vod_tv": "",
            "vod_weekday": "",
            "vod_area": getCdataValue(video.area),
            "vod_lang": getCdataValue(video.lang),
            "vod_year": getCdataValue(video.year),
            "vod_version": "",
            "vod_state": getCdataValue(video.state),
            "vod_author": "",
            "vod_jumpurl": "",
            "vod_tpl": "",
            "vod_tpl_play": "",
            "vod_tpl_down": "",
            "vod_isend": 0,
            "vod_lock": 0,
            "vod_level": 0,
            "vod_copyright": 0,
            "vod_points": 0,
            "vod_points_play": 0,
            "vod_points_down": 0,
            "vod_hits": 581,
            "vod_hits_day": 939,
            "vod_hits_week": 83,
            "vod_hits_month": 137,
            "vod_duration": "",
            "vod_up": 512,
            "vod_down": 838,
            "vod_score": "6.0",
            "vod_score_all": 7280,
            "vod_score_num": 728,
            "vod_time": getCdataValue(video.last),
            "vod_time_add": Math.floor(Date.now() / 1000),
            "vod_time_hits": 0,
            "vod_time_make": 0,
            "vod_trysee": 0,
            "vod_douban_id": 36427183,
            "vod_douban_score": "0.0",
            "vod_reurl": "",
            "vod_rel_vod": "",
            "vod_rel_art": "",
            "vod_pwd": "",
            "vod_pwd_url": "",
            "vod_pwd_play": "",
            "vod_pwd_play_url": "",
            "vod_pwd_down": "",
            "vod_pwd_down_url": "",
            "vod_content": getCdataValue(video.des),
            "vod_play_from": playFrom,
            "vod_play_server": "",
            "vod_play_note": "",
            "vod_play_url": playUrl,
            "vod_down_from": "",
            "vod_down_server": "",
            "vod_down_note": "",
            "vod_down_url": "",
            "vod_plot": 0,
            "vod_plot_name": "",
            "vod_plot_detail": "",
            "type_name": getCdataValue(video.type)
        };
        
        result.list.push(item);
    }
    
    return result;
}

// 启动服务器
Deno.serve(handleRequest);
