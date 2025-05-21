// 导入 deno-dom 用于 XML 解析
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

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
function getCdataValue(node: Element | null): string {
    if (!node) return '';
    return node.textContent.trim();
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
async function parseXml(xmlString: string): Promise<Document> {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    
    if (!xmlDoc) {
        throw new Error("Failed to parse XML document");
    }
    
    // 检查错误
    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
        throw new Error(`XML Parse Error: ${parserError.textContent}`);
    }
    
    return xmlDoc;
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
        let xmlDoc;
        try {
            xmlDoc = await parseXml(responseText);
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
                jsonResponse = await processVideoList(xmlDoc);
                break;
            case 'list':
                jsonResponse = await processList(xmlDoc);
                break;
            case 'detail':
                jsonResponse = await processDetail(xmlDoc);
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

async function processVideoList(xmlDoc: Document): Promise<any> {
    const list = xmlDoc.querySelector("list");
    const videos = xmlDoc.querySelectorAll("video");
    
    const result = {
        "code": 1,
        "msg": "数据列表",
        "page": list?.getAttribute("page") || "1",
        "pagecount": parseInt(list?.getAttribute("pagecount") || "0"),
        "limit": list?.getAttribute("pagesize") || "20",
        "total": parseInt(list?.getAttribute("recordcount") || "0"),
        "list": [] as any[]
    };

    for (const video of videos) {
        const name = getCdataValue(video.querySelector("name"));
        const dt = video.querySelector("dt");
        const dl = video.querySelector("dl");
        
        let playFrom = '';
        let playUrl = '';
        
        if (dt) {
            playFrom = getCdataValue(dt);
        } else if (dl) {
            const dd = dl.querySelector("dd");
            if (dd) {
                playFrom = dd.getAttribute("flag") || '';
            }
        }
        
        if (dl) {
            const dd = dl.querySelector("dd");
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
            "vod_id": parseInt(video.querySelector("id")?.textContent || "0"),
            "type_id": parseInt(video.querySelector("tid")?.textContent || "0"),
            "type_id_1": 2,
            "group_id": 0,
            "vod_name": name,
            "vod_sub": getCdataValue(video.querySelector("des")),
            "vod_en": pinyinConvert(name),
            "vod_status": 1,
            "vod_letter": firstLetter,
            "vod_color": "",
            "vod_tag": "",
            "vod_class": "",
            "vod_pic": getCdataValue(video.querySelector("pic")),
            "vod_pic_thumb": "",
            "vod_pic_slide": "",
            "vod_pic_screenshot": "",
            "vod_actor": getCdataValue(video.querySelector("actor")),
            "vod_director": getCdataValue(video.querySelector("director")),
            "vod_writer": "",
            "vod_behind": "",
            "vod_blurb": getCdataValue(video.querySelector("des")),
            "vod_remarks": getCdataValue(video.querySelector("note")),
            "vod_pubdate": getCdataValue(video.querySelector("year")),
            "vod_total": 0,
            "vod_serial": "0",
            "vod_tv": "",
            "vod_weekday": "",
            "vod_area": getCdataValue(video.querySelector("area")),
            "vod_lang": getCdataValue(video.querySelector("lang")),
            "vod_year": getCdataValue(video.querySelector("year")),
            "vod_version": "",
            "vod_state": getCdataValue(video.querySelector("state")),
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
            "vod_time": getCdataValue(video.querySelector("last")),
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
            "vod_content": getCdataValue(video.querySelector("des")),
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
            "type_name": getCdataValue(video.querySelector("type"))
        };
        
        result.list.push(item);
    }
    
    return result;
}

async function processList(xmlDoc: Document): Promise<any> {
    const list = xmlDoc.querySelector("list");
    const videos = xmlDoc.querySelectorAll("video");
    const classTypes = xmlDoc.querySelectorAll("ty");
    
    const result = {
        "code": 1,
        "msg": "数据列表",
        "page": list?.getAttribute("page") || "1",
        "pagecount": parseInt(list?.getAttribute("pagecount") || "0"),
        "limit": list?.getAttribute("pagesize") || "20",
        "total": parseInt(list?.getAttribute("recordcount") || "0"),
        "list": [] as any[],
        "class": [] as any[]
    };

    for (const video of videos) {
        const name = getCdataValue(video.querySelector("name"));
        result.list.push({
            "vod_id": parseInt(video.querySelector("id")?.textContent || "0"),
            "vod_name": name,
            "type_id": parseInt(video.querySelector("tid")?.textContent || "0"),
            "type_name": getCdataValue(video.querySelector("type")),
            "vod_en": pinyinConvert(name),
            "vod_time": getCdataValue(video.querySelector("last")),
            "vod_remarks": getCdataValue(video.querySelector("note")),
            "vod_play_from": getCdataValue(video.querySelector("dt"))
        });
    }

    for (const type of classTypes) {
        result.class.push({
            "type_id": parseInt(type.getAttribute("id") || "0"),
            "type_pid": 0,
            "type_name": type.textContent.trim()
        });
    }
    
    return result;
}

async function processDetail(xmlDoc: Document): Promise<any> {
    const list = xmlDoc.querySelector("list");
    const videos = xmlDoc.querySelectorAll("video");
    
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
        const name = getCdataValue(video.querySelector("name"));
        const dt = video.querySelector("dt");
        const dl = video.querySelector("dl");
        
        let playFrom = '';
        let playUrl = '';
        
        if (dt) {
            playFrom = getCdataValue(dt);
        } else if (dl) {
            const dd = dl.querySelector("dd");
            if (dd) {
                playFrom = dd.getAttribute("flag") || '';
            }
        }
        
        if (dl) {
            const dd = dl.querySelector("dd");
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
            "vod_id": parseInt(video.querySelector("id")?.textContent || "0"),
            "type_id": parseInt(video.querySelector("tid")?.textContent || "0"),
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
            "vod_pic": getCdataValue(video.querySelector("pic")),
            "vod_pic_thumb": "",
            "vod_pic_slide": "",
            "vod_pic_screenshot": "",
            "vod_actor": getCdataValue(video.querySelector("actor")),
            "vod_director": getCdataValue(video.querySelector("director")),
            "vod_writer": "",
            "vod_behind": "",
            "vod_blurb": getCdataValue(video.querySelector("des")),
            "vod_remarks": getCdataValue(video.querySelector("note")),
            "vod_pubdate": getCdataValue(video.querySelector("year")),
            "vod_total": 0,
            "vod_serial": "0",
            "vod_tv": "",
            "vod_weekday": "",
            "vod_area": getCdataValue(video.querySelector("area")),
            "vod_lang": getCdataValue(video.querySelector("lang")),
            "vod_year": getCdataValue(video.querySelector("year")),
            "vod_version": "",
            "vod_state": getCdataValue(video.querySelector("state")),
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
            "vod_time": getCdataValue(video.querySelector("last")),
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
            "vod_content": getCdataValue(video.querySelector("des")),
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
            "type_name": getCdataValue(video.querySelector("type"))
        };
        
        result.list.push(item);
    }
    
    return result;
}

// 启动服务器
Deno.serve(handleRequest);
