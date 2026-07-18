*CLAUDE.md から分離（2026-07-18）・内容は原文維持*

### 【STAGE2後半】発送料自動計算（profit.js拡張）

SpeedPAK（FedEx/DHL）の送料を
重量・サイズ・発送先から自動計算する。

実装場所：
仕入シミュレーターの「送料・関税」セクション
送料の入力方法に「SpeedPAK自動計算」を追加

入力項目：
・梱包サイズ（縦×横×高さ cm）
・梱包重量（kg）
・発送先国

出力：
・SpeedPAK FedEx料金
・SpeedPAK DHL料金
・SpeedPAK Economy料金
→ 3つを並べて最安値をハイライト表示

API：
・FedEx Rate API
・DHL Rate API
（各社Developer Programへの登録が必要）

---

