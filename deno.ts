// main.ts
import { serve } from "https://deno.land/std@0.128.0/http/server.ts";
import { parse } from "https://deno.land/x/xml@2.0.4/mod.ts";

// 配置
const proxySwitch = false; // 是否使用代理
const proxyUrl = 'https://proxyurl/'; // 代理地址
const proxyUrlEncode = false; // 代理是否支持URL编码

// 常见浏览器 UA
const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
  "Mozilla/5.0 (Linux; Android 11; Pixel 3 XL) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Mobile Safari/537.36",
];

// 辅助函数：提取CDATA和普通文本
function getCdataValue(node: any): string {
  if (!node) return '';
  
  if (typeof node === 'string') {
    return node.trim();
  }
  
  if (node['#text']) {
    return node['#text'].trim();
  }
  
  return '';
}

// 辅助函数：获取节点属性
function getAttribute(node: any, attr: string): string {
  if (!node || !node['@']) return '';
  return node['@'][attr] || '';
}

// 辅助函数：获取节点文本
function getText(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node.trim();
  if (node['#text']) return node['#text'].trim();
  return '';
}

// 辅助函数：简单拼音转换
function pinyinConvert(text: string): string {
  if (!text) return '';
  
  const firstChar = text.charAt(0);
  
  const pinyinMap: Record<string, string> = {
    '血': 'xue',
    '谜': 'mi',
    '拼': 'pin',
    '图': 'tu',
    '我': 'wo',
    '推': 'tui',
    '的': 'de',
    '孩': 'hai',
    '子': 'zi'
  };
  
  if (pinyinMap[firstChar]) {
    return pinyinMap[firstChar] + text.slice(1).replace(/\s+/g, '');
  }
  
  if (/^[a-zA-Z]/.test(text)) {
    return text.toLowerCase().replace(/\s+/g, '');
  }
  
  return 'x' + text.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
}

// 处理视频列表
function processVideoList(xmlData: any) {
  const result: Record<string, any> = {
    code: 1,
    msg: "数据列表",
    page: getAttribute(xmlData.rss.list, "page") || "1",
    pagecount: parseInt(getAttribute(xmlData.rss.list, "pagecount")) || 0,
    limit: getAttribute(xmlData.rss.list, "pagesize") || "20",
    total: parseInt(getAttribute(xmlData.rss.list, "recordcount")) || 0,
    list: []
  };

  if (!xmlData.rss.list.video) return result;
  
  const videos = Array.isArray(xmlData.rss.list.video) 
    ? xmlData.rss.list.video 
    : [xmlData.rss.list.video];

  for (const video of videos) {
    let playFrom = '';
    let playUrl = '';
    
    if (video.dt) {
      playFrom = getText(video.dt);
    } else if (video.dl?.dd?.['@']?.flag) {
      playFrom = video.dl.dd['@'].flag;
    }
    
    if (video.dl?.dd) {
      playUrl = getText(video.dl.dd);
    }
    
    const name = getText(video.name);
    let firstLetter = 'X';
    if (name) {
      firstLetter = name.charAt(0).toUpperCase();
      if (!/[A-Z]/.test(firstLetter)) {
        firstLetter = 'X';
      }
    }
    
    const item: Record<string, any> = {
      vod_id: parseInt(getText(video.id)) || 0,
      type_id: parseInt(getText(video.tid)) || 0,
      type_id_1: 2,
      group_id: 0,
      vod_name: name,
      vod_sub: getText(video.des),
      vod_en: pinyinConvert(name),
      vod_status: 1,
      vod_letter: firstLetter,
      vod_color: "",
      vod_tag: "",
      vod_class: "",
      vod_pic: getText(video.pic),
      vod_pic_thumb: "",
      vod_pic_slide: "",
      vod_pic_screenshot: "",
      vod_actor: getText(video.actor),
      vod_director: getText(video.director),
      vod_writer: "",
      vod_behind: "",
      vod_blurb: getText(video.des),
      vod_remarks: getText(video.note),
      vod_pubdate: getText(video.year),
      vod_total: 0,
      vod_serial: "0",
      vod_tv: "",
      vod_weekday: "",
      vod_area: getText(video.area),
      vod_lang: getText(video.lang),
      vod_year: getText(video.year),
      vod_version: "",
      vod_state: getText(video.state),
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
      vod_time: getText(video.last),
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
      vod_content: getText(video.des),
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
      type_name: getText(video.type)
    };
    
    result.list.push(item);
  }
  
  return result;
}

// 处理列表
function processList(xmlData: any) {
  const result: Record<string, any> = {
    code: 1,
    msg: "数据列表",
    page: getAttribute(xmlData.rss.list, "page") || "1",
    pagecount: parseInt(getAttribute(xmlData.rss.list, "pagecount")) || 0,
    limit: getAttribute(xmlData.rss.list, "pagesize") || "20",
    total: parseInt(getAttribute(xmlData.rss.list, "recordcount")) || 0,
    list: [],
    class: []
  };

  if (xmlData.rss.list.video) {
    const videos = Array.isArray(xmlData.rss.list.video) 
      ? xmlData.rss.list.video 
      : [xmlData.rss.list.video];

    for (const video of videos) {
      const name = getText(video.name);
      result.list.push({
        vod_id: parseInt(getText(video.id)) || 0,
        vod_name: name,
        type_id: parseInt(getText(video.tid)) || 0,
        type_name: getText(video.type),
        vod_en: pinyinConvert(name),
        vod_time: getText(video.last),
        vod_remarks: getText(video.note),
        vod_play_from: getText(video.dt)
      });
    }
  }

  if (xmlData.rss.class?.ty) {
    const types = Array.isArray(xmlData.rss.class.ty) 
      ? xmlData.rss.class.ty 
      : [xmlData.rss.class.ty];

    for (const type of types) {
      result.class.push({
        type_id: parseInt(getAttribute(type, "id")) || 0,
        type_pid: 0,
        type_name: getText(type)
      });
    }
  }
  
  return result;
}

// 处理详情
function processDetail(xmlData: any) {
  const result: Record<string, any> = {
    code: 1,
    msg: "数据列表",
    page: 1,
    pagecount: 1,
    limit: "20",
    total: 1,
    list: []
  };

  if (xmlData.rss.list.video) {
    const videos = Array.isArray(xmlData.rss.list.video) 
      ? xmlData.rss.list.video 
      : [xmlData.rss.list.video];

    for (const video of videos) {
      let playFrom = '';
      let playUrl = '';
      
      if (video.dt) {
        playFrom = getText(video.dt);
      } else if (video.dl?.dd?.['@']?.flag) {
        playFrom = video.dl.dd['@'].flag;
      }
      
      if (video.dl?.dd) {
        playUrl = getText(video.dl.dd);
      }
      
      const name = getText(video.name);
      let firstLetter = 'X';
      if (name) {
        firstLetter = name.charAt(0).toUpperCase();
        if (!/[A-Z]/.test(firstLetter)) {
          firstLetter = 'X';
        }
      }
      
      const item: Record<string, any> = {
        vod_id: parseInt(getText(video.id)) || 0,
        type_id: parseInt(getText(video.tid)) || 0,
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
        vod_pic: getText(video.pic),
        vod_pic_thumb: "",
        vod_pic_slide: "",
        vod_pic_screenshot: "",
        vod_actor: getText(video.actor),
        vod_director: getText(video.director),
        vod_writer: "",
        vod_behind: "",
        vod_blurb: getText(video.des),
        vod_remarks: getText(video.note),
        vod_pubdate: getText(video.year),
        vod_total: 0,
        vod_serial: "0",
        vod_tv: "",
        vod_weekday: "",
        vod_area: getText(video.area),
        vod_lang: getText(video.lang),
        vod_year: getText(video.year),
        vod_version: "",
        vod_state: getText(video.state),
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
        vod_time: getText(video.last),
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
        vod_content: getText(video.des),
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
        type_name: getText(video.type)
      };
      
      result.list.push(item);
    }
  }
  
  return result;
}

// 主请求处理函数
async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  
  const apiUrl = params.apiurl ? decodeURIComponent(params.apiurl) : '';
  delete params.apiurl;
  
  if (!apiUrl) {
    return new Response(JSON.stringify({
      code: 0,
      msg: "缺少apiurl参数"
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  
  let requestUrl;
  if (proxySwitch) {
    requestUrl = proxyUrlEncode 
      ? proxyUrl + encodeURIComponent(apiUrl) 
      : proxyUrl + apiUrl;
  } else {
    requestUrl = apiUrl;
  }
  
  const queryString = new URLSearchParams(params).toString();
  if (queryString) {
    requestUrl += (requestUrl.includes('?') ? '&' : '?') + queryString;
  }
  
  const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
  
  try {
    const response = await fetch(requestUrl, {
      headers: {
        'User-Agent': userAgent
      }
    });
    
    if (!response.ok) {
      throw new Error(`请求失败: ${response.status} ${response.statusText}`);
    }
    
    const xmlText = await response.text();
    const xmlData = await parse(xmlText);
    
    const ac = params.ac || '';
    let result;
    
    switch (ac) {
      case 'videolist':
        result = processVideoList(xmlData);
        break;
      case 'list':
        result = processList(xmlData);
        break;
      case 'detail':
        result = processDetail(xmlData);
        break;
      default:
        result = {
          code: 0,
          msg: "无效的请求"
        };
        break;
    }
    
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      code: -1,
      msg: `处理错误: ${error.message}`
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// 启动服务器
console.log("Server running at http://localhost:8000");
serve(handleRequest);
