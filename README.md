# Convert-XML-interface-of-CMS-10-to-JSON
只需一个脚本，即可将cms10 xml格式接口转换成标准cms10 json格式接口，以供不支持xml格式的影视采集站使用json格式进行采集

# API 代理与转换脚本

这是一个 PHP 脚本，用于代理和转换 XML API 数据为 JSON 格式。它支持多种请求类型，包括视频列表、分类列表和视频详情。

## 功能特性

- 代理请求功能（可配置开关）
- 随机 User-Agent 防止被屏蔽
- XML 到 JSON 的数据转换
- 支持多种 API 请求类型：
  - `videolist` - 视频列表
  - `list` - 简化的视频列表和分类
  - `detail` - 视频详细信息
- 错误日志记录
- CDATA 内容自动处理

## 配置选项

在脚本顶部可以修改以下配置：

```php
$proxySwitch = true;       // 是否使用代理 (true/false)
$proxyUrl = 'https://ll.9sd.top/eraysafeapi666/';  // 代理地址
$proxyUrlEncode = false;   // 代理是否支持URL编码 (true/false)
```

## 使用方法

### 基本请求格式

```
yourdomain.com/script.php?apiurl=原始API地址&ac=请求类型&其他参数...
```

### 参数说明

- `apiurl`: (必需) 原始 API 地址（需要代理时会被追加到代理地址后）
- `ac`: (必需) 请求类型，支持 `videolist`、`list` 或 `detail`
- 其他参数: 将直接传递给原始 API

### 示例请求

1. 获取视频列表:
   ```
   /script.php?apiurl=http://example.com/api.php&ac=videolist&t=1&pg=1
   ```

2. 获取分类列表:
   ```
   /script.php?apiurl=http://example.com/api.php&ac=list
   ```

3. 获取视频详情:
   ```
   /script.php?apiurl=http://example.com/api.php&ac=detail&ids=123
   或
   /script.php?apiurl=http://example.com/api.php&ac=videolist&ids=123
   ```

## 返回格式

返回数据为 JSON 格式，结构根据 `ac` 参数不同而有所变化。

### 通用返回字段

- `code`: 状态码 (1=成功, 0=无效请求, -1=错误)
- `msg`: 状态消息
- `page`: 当前页码
- `pagecount`: 总页数
- `limit`: 每页数量
- `total`: 总记录数

### 视频列表 (`ac=videolist` 或 `ac=list`)

额外包含 `list` 数组，每个元素包含视频基本信息。

### 视频详情 (`ac=detail`)

额外包含 `list` 数组，每个元素包含视频详细信息。

## 错误处理

错误会记录到 `debug.log` 文件中，并返回包含错误信息的 JSON 响应。

## 依赖

- PHP 5.6+
- libxml 扩展
- cURL 扩展

## 注意事项

1. 拼音转换功能 (`pinyin_convert`) 目前是简化版，如需准确转换需要集成完整的拼音库。
2. 代理功能需要确保代理服务器可用。
3. 日志文件 (`debug.log`) 会不断增长，需要定期清理或实现日志轮转。
