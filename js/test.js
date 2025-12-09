// -----------------------------
// 基本設定
// -----------------------------
const gridRows = 3;   // ブロックの行数
const gridCols = 3;   // ブロックの列数

let currentPlayer = 1;

// -----------------------------
// HTML生成
// -----------------------------
function generateBoard() {

    const blockSpace = $("#blockSpace");
    const barHGroup  = $("#barHorizontalGroup");
    const barVGroup  = $("#barVerticalGroup");

    blockSpace.empty();
    barHGroup.empty();
    barVGroup.empty();

    // 位置基準
    const blockSize = 170;      // CSSの --block-size と合わせてOK
    const barHThick = 20;
    const barVThick = 20;
    const margin = 10;

    // -----------------------------
    // ブロック生成
    // -----------------------------
    for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {

            const block = $('<div class="block colorNotSelected"></div>');

            // absolute配置
            block.css({
                position: "absolute",
                top:  r * (blockSize + margin),
                left: c * (blockSize + margin),
                width: blockSize,
                height: blockSize,
                border: "1px solid black"
            });

            blockSpace.append(block);
        }
    }

    // -----------------------------
    // 横棒生成
    // -----------------------------
    let hIndex = 0;
    for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols - 1; c++) {

            const bar = $('<div class="barHorizontal colorNotSelected"></div>');

            bar.attr("data-bar-h", hIndex++);

            bar.css({
                top: r * (blockSize + margin) + (blockSize / 2 - barHThick / 2),
                left: c * (blockSize + margin) + blockSize,
                width: blockSize,
                height: barHThick
            });

            barHGroup.append(bar);
        }
    }

    // -----------------------------
    // 縦棒生成
    // -----------------------------
    let vIndex = 0;
    for (let r = 0; r < gridRows - 1; r++) {
        for (let c = 0; c < gridCols; c++) {

            const bar = $('<div class="barVertical colorNotSelected"></div>');

            bar.attr("data-bar-v", vIndex++);

            bar.css({
                top: r * (blockSize + margin) + blockSize,
                left: c * (blockSize + margin) + (blockSize / 2 - barVThick / 2),
                width: barVThick,
                height: blockSize
            });

            barVGroup.append(bar);
        }
    }
}

// -----------------------------
// 呼び出し
// -----------------------------
generateBoard();

// ブロック（マス）
const blocks = Array(gridRows * gridCols).fill({
    owner: null,
    completed: false,
});

// 横棒（rows*(cols-1)）
const barsHorizontal = Array(gridRows * (gridCols - 1)).fill({
    owner: null,
    used: false,
});

// 縦棒（(rows-1)*cols）
const barsVertical = Array((gridRows - 1) * gridCols).fill({
    owner: null,
    used: false,
});

// -----------------------------
// 棒とブロックの関連表を作る
// -----------------------------
const barRelationsHorizontal = [];
const barRelationsVertical = [];

// 横棒の i 番目がどの block に接しているか
for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols - 1; c++) {
        const barIndex = r * (gridCols - 1) + c;

        const blockLeft  = r * gridCols + c;
        const blockRight = r * gridCols + (c + 1);

        barRelationsHorizontal[barIndex] = [blockLeft, blockRight];
    }
}

// 縦棒の i 番目がどの block に接しているか
for (let r = 0; r < gridRows - 1; r++) {
    for (let c = 0; c < gridCols; c++) {
        const barIndex = r * gridCols + c;

        const blockTop    = r * gridCols + c;
        const blockBottom = (r + 1) * gridCols + c;

        barRelationsVertical[barIndex] = [blockTop, blockBottom];
    }
}

// -----------------------------
// UI 用：バーに番号を ID として付与する
// -----------------------------
$(".barHorizontal").each(function (i) {
    $(this).attr("data-bar-h", i);
});

$(".barVertical").each(function (i) {
    $(this).attr("data-bar-v", i);
});

// -----------------------------
// クリックイベント（座標不要版）
// -----------------------------

$(".barHorizontal").on("click", function () {
    const index = Number($(this).data("bar-h"));
    handleBarClick(barsHorizontal, barRelationsHorizontal, index, this);
});

$(".barVertical").on("click", function () {
    const index = Number($(this).data("bar-v"));
    handleBarClick(barsVertical, barRelationsVertical, index, this);
});

// -----------------------------
// 棒がクリックされたときの共通ロジック
// -----------------------------
function handleBarClick(barList, relations, index, domElement) {

    // すでに選ばれた棒は無効
    if (barList[index].used) return;

    // 棒の状態を更新
    barList[index] = {
        used: true,
        owner: currentPlayer
    };

    // UI反映
    $(domElement).addClass(currentPlayer === 1 ? "colorSelectedPlayer1" : "colorSelectedPlayer2");

    // この棒に接している block を調べる
    const connectedBlocks = relations[index];

    let completedAny = false;

    connectedBlocks.forEach(blockIndex => {
        if (!blocks[blockIndex]) return;

        if (isBlockCompleted(blockIndex)) {
            blocks[blockIndex] = {
                completed: true,
                owner: currentPlayer
            };

            // UIに色付け
            $(".block").eq(blockIndex)
                .addClass("color" + (currentPlayer === 1 ? "SelectedPlayer1" : "SelectedPlayer2"));

            completedAny = true;
        }
    });

    // 誰かが完成させた → 同じプレイヤーが続行
    if (!completedAny) {
        currentPlayer = currentPlayer === 1 ? 2 : 1;
    }

    updatePlayerUI();
}

// -----------------------------
// ブロックが完成しているか判定
// -----------------------------
function isBlockCompleted(blockIndex) {

    const r = Math.floor(blockIndex / gridCols);
    const c = blockIndex % gridCols;

    // 必要な4本の棒を確認
    const top    = barsHorizontal[r * (gridCols - 1) + c - (c === 0 ? 0 : 1)];
    const bottom = barsHorizontal[(r + 1) * (gridCols - 1) + c - (c === 0 ? 0 : 1)];
    const left   = barsVertical[r * gridCols + c];
    const right  = barsVertical[r * gridCols + (c + 1)];

    return (
        top && top.used &&
        bottom && bottom.used &&
        left && left.used &&
        right && right.used
    );
}

// -----------------------------
// UI更新
// -----------------------------
function updatePlayerUI() {
    $(".currentPlayerName").text(
        currentPlayer === 1 ? "プレイヤー1" : "プレイヤー2"
    );
}
