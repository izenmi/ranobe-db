# ranobe-db

日本語ライトノベル作品を著者・イラストレーター・出版社(レーベル)・受賞歴・テーマから検索できるファンデータベース。[jsfdb.jp](https://jsfdb.jp/)(SF小説データベース)のライトノベル版。翻訳者の代わりにイラストレーターを軸に据えているのが差別化点。

- 公開URL: https://izenmi.github.io/ranobe-db/
- リポジトリ: `izenmi/ranobe-db`(public。GitHub Pagesは無料枠だとpublicでないと使えない)
- スタック: React 18 + TypeScript + Vite 5 + `react-router-dom`(`HashRouter`。GitHub Pagesにサーバサイドルーティングがないため)

## データフロー(source → generated)

- `public/data/source/*.json` … 手作業で作成・**コミットする**一次データ(works/authors/illustrators/publishers/themes/awards)
- `public/data/generated/*.json` … `scripts/generate-manifest.mjs` がビルド時に生成する非正規化データ。**`.gitignore`対象**、`predev`/`prebuild`npmスクリプトで毎回再生成するので手で編集しない
- 生成スクリプトは全Workの`authorIds`/`illustratorIds`/`publisherId`/`themeIds`/`awardResults[].awardId`が対応するsourceに存在するかを検証し、存在しなければビルドを失敗させる(id誤字をCIで機械的に防ぐ)
- 著者・イラストレーター・出版社・テーマの詳細ページは、それぞれの作品一覧を`WorkGenerated`型でフル展開して埋め込む(`WorkCard`をそのまま再利用できるようにするため)

## データ入力ルール(最重要)

- **出典は日本語版Wikipediaを一次情報とする**。ユーザーが口頭で伝えるタイトル・著者名・レーベル名・巻数等はしばしば誤っているので、書き込む前に必ずWikipediaで裏取りする。矛盾があれば訂正し、`sourceNote`に何を確認したか・何が未確認かを明記する
- **あらすじはコピペ禁止**。Wikipediaの文章表現をそのまま転記せず、150〜250字程度で必ず自分の言葉で要約する(事実自体は著作権保護対象外だが、文章表現はCC BY-SA 4.0の対象になりうるため)
- **表紙画像は`covers-cache.json`にあれば実画像、なければプレースホルダー**。`scripts/fetch-covers.mjs`(`npm run fetch-covers`、要`RAKUTEN_APP_ID`/`RAKUTEN_ACCESS_KEY`)が楽天ブックス書籍検索APIでシリーズごとのISBN・表紙URLを解決し`public/data/source/covers-cache.json`に**コミットする**(ビルド時には叩かない)。`WorkCover`コンポーネントは`coverUrl`があれば`<img>`、なければタイトル文字列のハッシュ値からパステルカラーのプレースホルダーを生成(画像404時もプレースホルダーにフォールバック)。openBDは版元ドットコム非加盟のKADOKAWA系レーベルの書影をほぼ持たず実測カバー率0%だったため不採用(2026-08-01検証)。直リンクの画像URL(`m.media-amazon.com/images/I/...`等)を推測・ハードコードすることはしない
- **購入リンクは検索URL形式のみ**。個別商品ページへの直リンク(ASIN指定の`/dp/<ASIN>`等)は使わない。理由: 直リンクには巻ごとのISBN/ASINデータが必要だが、`works.json`はシリーズ単位のデータしか持っておらず、収集コストに見合わないとユーザーと合意済み(2026-08-01)。`amazonSearchUrl(title, volumeLabel?)`(`src/ui/common/WorkCover.tsx`)がアフィリエイトタグ`izenmi-22`付きの検索URLを生成する
- **Web小説サイトへのリンクは検索URLパターンのみ**使う(`小説家になろう`: `https://yomou.syosetu.com/search.php?word=<encoded>`、`カクヨム`: `https://kakuyomu.jp/search?q=<encoded>`)。個別作品のパーマリンクは推測しない
- 新規idを追加する前に既存の`authors.json`/`illustrators.json`/`publishers.json`を確認し、同一人物・レーベルの重複登録を避ける(既存作の著者が新規作にも登場するケースが多い)

## データ拡充時の作業フロー

シードデータの拡充は**必ず小バッチ(10〜15作品程度)で作業し、バッチごとに即コミット・push**する。理由: セッションのトークン/時間制限で作業が中断されても、それまでの成果を失わないため。

1. 候補作品をリストアップ(受賞作を優先する指示がある場合は新人賞受賞歴のある作品を優先)
2. `general-purpose`サブエージェントにWikipedia調査を依頼(事実確認・訂正・あらすじ要約案の作成)し、コード編集はさせない
3. 調査結果をもとに`authors.json`/`illustrators.json`/`publishers.json`/`awards.json`/`themes.json`/`works.json`へPythonスクリプト(`json.load`→`extend`→`json.dump(..., ensure_ascii=False, indent=2)`)または`Edit`で追記。追記前に対象idが既存配列にないか確認する
4. `npm run build`(内部で`generate-manifest`が整合性チェックを行う)が通ることを確認
5. `git add public/data/source && git commit && git push`

## 受賞歴(awards)の方針

新人賞(公募のデビュー契機賞)だけでなく、**人気投票・ランキング系のアワードも`awardResults`に含める**(2026-08-01にユーザーが「新人賞にこだわらない」と明言し方針拡張)。現在`awards.json`に登録済みのカテゴリ:

- 新人賞: 電撃小説大賞、スニーカー大賞、ファンタジア大賞、このライトノベルがすごい!大賞、MF文庫Jライトノベル新人賞、GA文庫大賞、ネット小説大賞、カクヨムWeb小説コンテスト、ライト文芸新人賞、電撃の新文芸スタートアップコンテスト、エンターブレインえんため大賞、小学館ライトノベル大賞
- 人気投票・ランキング: 『このライトノベルがすごい!』年間ランキング(新人賞の「大賞」とは別id)、みんなで選ぶベストラノベ、ラノベ好き書店員大賞、電子書籍アワード、SUGOI JAPAN Award、次のヒット作はこれだ!新作ラノベ総選挙、本屋大賞、星雲賞、ライトノベルアワード、大学読書人大賞、ライトノベルランキング(日経BP社)

**カウントする/しないの基準:**
- 作品(シリーズ)自体の順位が明記されているものだけを採用する。「掲載されている」だけで具体的順位が不明なものは見送る
- **キャラクター人気投票のみ**(男性/女性キャラクター部門など)は作品自体の受賞ではないため対象外
- **アニメ版・コミカライズ版のみが対象の賞**(AnimaniA賞、ニュータイプアニメアワード、次にくるマンガ大賞、クランチロール・アニメアワード等)は小説自体の受賞ではないため対象外
- **著者の別作品での受賞**と**本作自体の受賞**を明確に区別する(`sourceNote`に明記)。例: ベン・トーの著者アサウラは別作品『黄色い花の紅』でスーパーダッシュ小説新人賞を受賞しているが、ベン・トー自体は非受賞
- 賞の名称が時代とともに変わっている場合(電撃ゲーム小説大賞→電撃小説大賞など)は既存idを再利用し、`sourceNote`に当時の名称を明記する

新人賞とランキング系を区別してフィルターする機能は未実装(「既知の未着手事項」を参照)。

## テーマタグの方針

jsfdbのような大量タグ(1テーマ1〜数作品)にはせず、再利用可能な少数タグに絞る。1作品あたり平均4〜5テーマ程度が目安。新規作品を追加する際、既存タグで表現しきれない要素があれば`themes.json`にタグを追加してよい(スポーツ/ダークファンタジー/逆異世界/戦記/デスゲーム/終末・ポストアポカリプス/歴史IFなど、これまでも都度追加してきた)。

## デザイン方針

- パステルカラー基調、グラデーションはなるべく使わない、水色(`--color-blue-deep`等)がメインアクセント
- ページ背景は黒一色固定(`:root`で不変。`[data-theme="light"]`のパステル明テーマ定義は残しているが現状UIから到達不能=未使用のドーマント状態)
- 装飾(影・グラデーション・点線ボーダー等)は基本つけない。「真っ黒でよい」「シャドウも微妙」など過剰な装飾は嫌われる傾向
- ライトノベルらしい可愛いポップさは、装飾より配色・フォント(見出しに`M PLUS Rounded 1c`)・チップ(テーマ・受賞)で出す
- PC画面の余白を無駄にしない(`.work-grid`は`repeat(auto-fill, minmax(420px, 1fr))`の2カラムグリッド、`.page`は`max-width: 1200px`)

## コマンド

```sh
npm install
npm run dev       # http://localhost:5173/ranobe-db/
npm run build      # 型チェック + データ整合性チェック + ビルド
npm run preview
```

`main`へのpushで`.github/workflows/deploy.yml`が自動ビルド・GitHub Pagesデプロイを行う。

## 表紙画像・購入リンク(2026-08-01実装)

- **表紙画像**: `npm run fetch-covers`(要`RAKUTEN_APP_ID`/`RAKUTEN_ACCESS_KEY`環境変数、[楽天ウェブサービス](https://webservice.rakuten.co.jp/)で無料即時発行)が楽天ブックス書籍検索API(`BooksTotal/Search`)でシリーズタイトルから代表巻(基本1巻)のISBN・表紙URLを解決し、`public/data/source/covers-cache.json`に保存する。105作品中90作品(86%)で解決済み(2026-08-01時点)。解決できなかった作品(絶版などで楽天カタログに1巻が存在しない等)はプレースホルダーのまま。マッチ精度に問題があれば`covers-cache.json`を直接手編集して直せる(`isbn`/`coverUrl`/`matchedTitle`を書き換えるだけ)
  - このAPIは`Referer`/`Origin`ヘッダーがアプリ登録時の「アプリケーションURL」(`https://izenmi.github.io/ranobe-db/`)と一致している必要がある(`scripts/fetch-covers.mjs`内の`REFERER_URL`/`ORIGIN_URL`で送信)
  - openBDは版元ドットコム非加盟のKADOKAWA系レーベルの書影をほぼ持たず実測カバー率0%だったため不採用と判断済み(再検討不要)
- **購入リンク**: `amazonSearchUrl(title, volumeLabel?)`(`src/ui/common/WorkCover.tsx`)がアフィリエイトタグ`izenmi-22`付きの検索URLを生成。作品詳細ページに「1巻をAmazonで探す」「シリーズ全体を探す」の2リンクを表示

## 既知の未着手事項

- **アニメ化/コミック化フィルター**: 作品一覧・テーマ詳細ページに、メディアミックス状況で絞り込めるフィルターを追加する
- **新人賞 / それ以外の賞でのフィルター**: 受賞歴を「新人賞(デビュー契機の公募賞)」と「それ以外(このラノすごい!等の人気投票・ランキング)」に区別してフィルターできるようにする。awards.jsonに賞の種別を表すフィールドの追加が必要
- **表紙画像の未解決15作品**: `npm run fetch-covers`で見つからなかった作品(なれる!SE、キーリ、塩の街、イリヤの空、半分の月がのぼる空など)は、`covers-cache.json`を手動で埋めるか、楽天カタログ側に該当書誌がないか個別確認する
