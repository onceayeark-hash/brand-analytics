---
name: plan-before-new-file
enabled: true
event: file
action: warn
pattern: "^(?!.*\\.(html|md|sql|json|env)$).*\\.js$"
---
📋 planを先に実行しましたか？ 新ファイル作成前にplanでの設計確認が必須です。
