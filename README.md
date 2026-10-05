# MemoLink 网页版（Firebase）

错题・同类题・知识点・生词 + 做题（Ping-t 式）+ AML 审查官养成。
功能和 Spring Boot 版（V1.7）相同；手机、电脑都能用，数据在云端自动同步。

## 文件结构
```
index.html            入口
css/app.css           样式（和 Spring Boot 版相同）
js/config.js          ★ 只需要改这里：填 firebaseConfig
js/app.js             启动、Google 登录、页面路由
js/model.js           数据模型（字段名 = Spring Boot 的 StudyItem）
js/services.js        业务逻辑（= StudyService / LinkService / StatsService / AmlService）
js/store/             数据存取层（= Repository）
  index.js              接口
  local-store.js        体验模式：存在浏览器
  firestore-store.js    云端：Firestore
js/pages/             各个画面（= Thymeleaf 模板 + Controller）
js/aml-game.js        AML 小游戏（和 Spring Boot 版相同）
firestore.rules       Firestore 安全规则
```

## Firestore 里的数据
```
users/{uid}/items/{id}   错题・生词…（字段和 StudyItem 一样）
users/{uid}/links/{id}   关联 { fromId, toId, relation }
users/{uid}/days/{日期}   每天做题数 { count, correct }
users/{uid}/meta/shadows 最近 50 次跟读分数
```
启动时把自己的数据读进内存，之后的读取不消耗云端次数。

## 以后改回 Spring Boot
- 数据字段名和 Spring Boot 版完全一致；Spring Boot 版「统计 → 导出」的文件可以直接导入这里，反过来也容易写。
- 只要新增 `js/store/rest-store.js`（用 fetch 调 Spring Boot 的 REST API，实现 all/get/save/remove），
  在 `js/app.js` 里换掉 store，页面和业务逻辑不用改。

## 本地试用
用任意静态服务器打开即可（ES Modules 需要 http，不能双击 file://）：
```
python3 -m http.server 8000   →  http://localhost:8000
```
