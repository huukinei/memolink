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

## AML 可编辑学习版（V1.8）

AML 页面已改成「内容和练习分离」的结构，现有 Firebase / 本地存储继续可用。

### ① 多角度词汇记忆
在 AML 的每个 Day 页面点击「✏️ 管理词汇内容」即可自己添加或编辑词汇。
每条词汇只保存一次：

- 英文缩写 / 主词：KYC
- 英文全称：Know Your Customer
- 日语：顧客確認
- 中文：客户身份识别 / 客户尽职调查
- 记忆关键词：誰？何のため？リスクは？
- 一句话理解、具体检查内容、例句（均可选）

系统会自动从一条记录生成多方向题目，不需要手工重复录题：
`缩写 ↔ 英文 ↔ 日语 ↔ 中文`

练习分为：
1. 选择题
2. 半填空
3. 完整填空

### AML 学习结构
1. 多角度词汇记忆
2. 概念理解
3. 分类判断（KYC / Filtering / Monitoring）
4. 业务流程理解（Scenario → Threshold → Hit → Alert）
5. 案例与日语输出

旧版「三者分类 / 规则判定 / 影子跟读」功能仍保留，只是重新放进学习路线里。
