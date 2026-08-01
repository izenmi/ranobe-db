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
- **表紙画像は実画像を使わない**。`WorkCover`コンポーネントがタイトル文字列のハッシュ値からパステルカラーのプレースホルダーを生成する。Amazon商品ページへの検索リンク(`amazonSearchUrl`)は張ってよいが、直リンクの画像URL(`m.media-amazon.com/images/I/...`等)は推測・ハードコードしない(PA-API 5.0の正規クレデンシャルなしに合法的に取得できないため)
- **Web小説サイトへのリンクは検索URLパターンのみ**使う(`小説家になろう`: `https://yomou.syosetu.com/search.php?word=<encoded>`、`カクヨム`: `https://kakuyomu.jp/search?q=<encoded>`)。個別作品のパーマリンクは推測しない
- 新規idを追加する前に既存の`authors.json`/`illustrators.json`/`publishers.json`を確認し、同一人物・レーベルの重複登録を避ける(既存作の著者が新規作にも登場するケースが多い)

## データ拡充時の作業フロー

シードデータの拡充は**必ず小バッチ(10〜15作品程度)で作業し、バッチごとに即コミット・push**する。理由: セッションのトークン/時間制限で作業が中断されても、それまでの成果を失わないため。

1. 候補作品をリストアップ(受賞作を優先する指示がある場合は新人賞受賞歴のある作品を優先)
2. `general-purpose`サブエージェントにWikipedia調査を依頼(事実確認・訂正・あらすじ要約案の作成)し、コード編集はさせない
3. 調査結果をもとに`authors.json`/`illustrators.json`/`publishers.json`/`awards.json`/`themes.json`/`works.json`へPythonスクリプト(`json.load`→`extend`→`json.dump(..., ensure_ascii=False, indent=2)`)または`Edit`で追記。追記前に対象idが既存配列にないか確認する
4. `npm run build`(内部で`generate-manifest`が整合性チェックを行う)が通ることを確認
5. `git add public/data/source && git commit && git push`

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

## 既知の未着手事項

- **アニメ化/コミック化フィルター**: 作品一覧・テーマ詳細ページに、メディアミックス状況で絞り込めるフィルターを追加する
- **新人賞 / それ以外の賞でのフィルター**: 受賞歴を「新人賞(デビュー契機の公募賞)」と「それ以外(このラノすごい!等の人気投票・ランキング)」に区別してフィルターできるようにする。awards.jsonに賞の種別を表すフィールドの追加が必要
- **表紙画像はopenBDから取得**: Amazon PA-API 5.0は実績要件を満たせず利用不可と判明(再検討不要)。代わりに[openBD](https://openbd.jp/)のISBN検索APIから表紙画像を取得する方針
- **購入リンクはAmazonアフィリエイトタグ付き検索URL**: 直リンクではなく検索URL形式に、ユーザーのアソシエイトタグを付与する。フォーマット: `https://www.amazon.co.jp/s?k=<作品名+巻数をURLエンコード>&tag=izenmi-22`。既存のWeb小説検索リンク(なろう/カクヨム)と同じ「検索URLのみ、直リンク・画像URL推測禁止」の考え方を踏襲する
