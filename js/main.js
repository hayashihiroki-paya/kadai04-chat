// -----------------------------
// firebase読み込み設定
// -----------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    deleteDoc,
    setDoc,
    doc,
    serverTimestamp,
    onSnapshot,
    query,
    orderBy,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
const firebaseConfig = {
    apiKey: "",
    authDomain: "dot-and-box-acde5.firebaseapp.com",
    projectId: "dot-and-box-acde5",
    storageBucket: "dot-and-box-acde5.firebasestorage.app",
    messagingSenderId: "734084617388",
    appId: "1:734084617388:web:b8042e5a25bf72da367b09"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// -----------------------------
// 基本設定
// -----------------------------
const gridRows = 5;   // ブロックの行数
const gridCols = 3;   // ブロックの列数

// 管理用 データとしてサーバーにも載せるもの
let barDataVertical = [];
let barDataHorizontal = [];
let blockData = [];
let currentPlayer = [true, false];
let currentScore = [0, 0];
// データを上書きして管理する方針に変更したのでidを保持しておく
let dataID = "gameData";
let playerID = "playerData";

// プレイヤーが1番と2番それぞれどっちに着席しているか
// 初期値falseで着席したらtrueに
// サーバー上で座席が埋まってるかを判定するための配列
let isPlayers = [false, false];
// ローカル上で自分が着席してるかを判定するもの
let isEntry = [false, false];
// playerの名前を記録して、相手の画面にも反映させる
let playerName = ["", ""];
// サーバ上の操作プレイヤーとローカル上で自分が着席してる情報が一致し例れば操作できるようにする
// 判定用のboolean
let isTurnPlayer = false;
// サーバー経由で相手がリセットボタン押したときを判定するためのフラグ
let isReset = false;


// ------------------------------
// 画面の初期描画処理
// ------------------------------

// $("#blockSpace").html()の中身を作成する
// ブロックや縦横の棒の固定値
const blockSize = 170;
const barHThick = 20;
const barVThick = 20;
const margin = 20;
// $("#blockSpace")のサイズをブロック数に合わせて設定して親要素の中央に
// $("#blockSpace")要素の中にブロックと縦横の棒を描画していきます
$("#blockSpace").css({
    width: (blockSize + margin) * gridRows + margin,
    height: (blockSize + margin) * gridCols + margin,
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)"
});

// ブロック描画
// 左上から右、右端まで行ったら一列下を
for (let r = 0; r < gridCols; r++) {

    for (let c = 0; c < gridRows; c++) {
        const block = $(`<div class="block colorNotSelected"></div>`);
        // ブロックの状態を管理
        blockData.push("notSelected");
        // absolute配置 親要素は $("#blockSpace")
        block.css({
            position: "absolute",
            top: r * (blockSize + margin) + margin,
            left: c * (blockSize + margin) + margin,
            width: blockSize,
            height: blockSize,
            border: "1px solid black"
        });

        $("#blockSpace").append(block);
    }
}


// 縦横それぞれのhtmlの中身を作成
// 横
for (let r = 0; r < gridCols + 1; r++) {

    for (let c = 0; c < gridRows; c++) {
        const bar = $('<div class="barHorizontal colorNotSelected"></div>');
        // absolute配置 親要素は $("#blockSpace")
        bar.css({
            top: r * (blockSize + margin),
            left: c * (blockSize + margin) + margin,
            width: blockSize,
            height: barHThick
        });

        $("#blockSpace").append(bar);
    }
}
// 縦
for (let r = 0; r < gridCols; r++) {

    for (let c = 0; c < gridRows + 1; c++) {
        const bar = $('<div class="barVertical colorNotSelected"></div>');
        // absolute配置 親要素は $("#blockSpace")
        bar.css({
            top: r * (blockSize + margin) + margin,
            left: c * (blockSize + margin),
            width: barVThick,
            height: blockSize
        });

        $("#blockSpace").append(bar);
    }
}


// ------------------------------
// クリックされたときの動作
// ------------------------------

// クリックされたときにクラスの付け替えで色を変える
// あとからプレイヤーどっちの操作なのかで色など変更する
// 横向きの処理
$(".barHorizontal").on('click', async function () {
    // このターンのプレイヤーであるときだけ処理を行う
    if (isTurnPlayer) {
        // 何番目が押されたかの判定
        const index = $(".barHorizontal").index(this);
        // 該当する番号の管理Flag変更 既に選択済みの時は処理しない
        if (barDataHorizontal[index] === "notSelected") {
            // "selectedPlayer1","selectedPlayer2"の該当するほうを入れる
            barDataHorizontal[index] = selectPlayerCheck(isEntry);

            // 色の付け替え
            $(this).removeClass("colorNotSelected");
            // "colorSelectedPlayer1","colorSelectedPlayer2"の該当するほうを入れる
            const colorClass = paintColor(isEntry);
            $(this).addClass(colorClass);

            // ブロック囲われているかチェックする
            // blockData配列の操作も行う
            isTurnPlayer = blockCheck();
            // 操作権がなくなっていたらサーバーに送るほうも変更する
            if (!isTurnPlayer) {
                for (let i = 0; i < isEntry.length; i++) {
                    // ローカルのプレイヤ番号がtrueの時同じ番号がtrueになってたということ
                    // 同じ番号のcurrentPlayerをfalseにする
                    // ローカルのプレイヤ番号がfalseの時同じ番号がtrueに変わることで相手の操作順に変わったということ
                    if (isEntry[i] === true) {
                        currentPlayer[i] = false;
                    } else if (isEntry[i] === false) {
                        currentPlayer[i] = true;
                    }
                }
            }

            // サーバーにアップロードするデータをまとめる
            const postData = {
                block: blockData,
                horizontal: barDataHorizontal,
                vertical: barDataVertical,
                turnPlayer: currentPlayer,
                score: currentScore,
                time: serverTimestamp()
            }
            await setDoc(doc(db, "data", dataID), postData);
        }
    }
});

// 縦向きの処理
$(".barVertical").on('click', async function () {
    if (isTurnPlayer) {
        // 何番目が押されたかの判定
        const index = $(".barVertical").index(this);
        // 該当する番号の管理Flag変更
        if (barDataVertical[index] === "notSelected") {
            // "selectedPlayer1","selectedPlayer2"の該当するほうを入れる
            barDataVertical[index] = selectPlayerCheck(isEntry);

            // 色の付け替え
            $(this).removeClass("colorNotSelected");
            // "colorSelectedPlayer1","colorSelectedPlayer2"の該当するほうを入れる
            const colorClass = paintColor(isEntry);
            $(this).addClass(colorClass);

            isTurnPlayer = blockCheck();
            // 操作権がなくなっていたらサーバーに送るほうも変更する
            if (!isTurnPlayer) {
                for (let i = 0; i < isEntry.length; i++) {
                    // ローカルのプレイヤ番号がtrueの時同じ番号がtrueになってたということ
                    // 同じ番号のcurrentPlayerをfalseにする
                    // ローカルのプレイヤ番号がfalseの時同じ番号がtrueに変わることで相手の操作順に変わったということ
                    if (isEntry[i] === true) {
                        currentPlayer[i] = false;
                    } else if (isEntry[i] === false) {
                        currentPlayer[i] = true;
                    }
                }
            }

            // サーバーに送るデータを作成
            const postData = {
                block: blockData,
                horizontal: barDataHorizontal,
                vertical: barDataVertical,
                turnPlayer: currentPlayer,
                score: currentScore,
                time: serverTimestamp()
            }
            // データを上書き
            await setDoc(doc(db, "data", dataID), postData);
        }
    }
});

// ------------------------------
// UI操作関連
// ------------------------------

// 離着席処理
// entry
$(".entryButton").on('click', async function () {

    // 押された着席のボタンの番号を取得
    const index = $(".entryButton").index(this);

    // 座席が未使用（isPlayers[index]がfalse）かつ、あなたがどっちにも座ってない（isEntryが全部false）とき
    if (!isPlayers[index] && isEntry.every(v => !v)) {
        // どちらもtrueにして着席
        isEntry[index] = true;
        isPlayers[index] = true;

        // 着席ボタンと同じ親要素内のプレイヤーネームを表示する
        const parentBox = $(this).closest(".userInterfaceBox");
        playerName[index] = parentBox.find("input[type=text]").val();
        parentBox.find(".playerName").text(playerName[index]);

        // サーバーに情報保存
        const postData = {
            isPlayers: isPlayers,
            name: playerName,
            time: serverTimestamp()
        }
        await setDoc(doc(db, "players", playerID), postData);
    }
});

// exit
$(".exitButton").on('click', async function () {

    // 押された離席のボタンの番号を取得
    const index = $(".exitButton").index(this);

    // 座席が使用中（isPlayers[index]がtrue）かつ、あなたの座席（isEntry[index]）が一致してるとき
    if (isPlayers[index] && isEntry[index]) {
        // どちらもfalseにして離席したことになる
        isEntry[index] = false;
        isPlayers[index] = false;

        // 離席ボタンと同じ親要素内のプレイヤーネームを削除する
        const parentBox = $(this).closest(".userInterfaceBox");
        playerName[index] = "";
        parentBox.find(".playerName").text("");

        // サーバーに情報保存
        const postData = {
            isPlayers: isPlayers,
            name: playerName,
            time: serverTimestamp()
        }
        await setDoc(doc(db, "players", playerID), postData);
    }
});

// リセットボタン操作
$("#resetButton").on('click', function () {
    // すべてのデータを初期値に戻して上書きする処理を、ゲーム終了時にも動作させるので
    // 内部処理を全部関数にまとめました
    gameReset();
})

// ------------------------------
// データ更新時の処理
// ------------------------------

const q = query(collection(db, "data"), orderBy("time", "desc"));
onSnapshot(q, (querySnapshot) => {
    // firestore 形式のデータである querySnapshot.docs を入力する
    const documents = dataDocuments(querySnapshot.docs);

    // 各種配列を持ってきたデータに上書きする
    blockData = documents[0].data.block;
    barDataHorizontal = documents[0].data.horizontal;
    barDataVertical = documents[0].data.vertical;
    currentPlayer = documents[0].data.turnPlayer;
    currentScore = documents[0].data.score;

    // 描画処理 色変更を行う
    $(".block").each(function (e) {
        if (blockData[e] === "notSelected") {
            $(this).removeClass("colorSelectedPlayer1");
            $(this).removeClass("colorSelectedPlayer2");
            $(this).addClass("colorNotSelected");
        } else if (blockData[e] === "selectedPlayer1") {
            $(this).removeClass("colorNotSelected");
            $(this).addClass("colorSelectedPlayer1");
        } else if (blockData[e] === "selectedPlayer2") {
            $(this).removeClass("colorNotSelected");
            $(this).addClass("colorSelectedPlayer2");
        }
    });
    $(".barHorizontal").each(function (e) {
        if (barDataHorizontal[e] === "notSelected") {
            $(this).removeClass("colorSelectedPlayer1");
            $(this).removeClass("colorSelectedPlayer2");
            $(this).addClass("colorNotSelected");
        } else if (barDataHorizontal[e] === "selectedPlayer1") {
            $(this).removeClass("colorNotSelected");
            $(this).addClass("colorSelectedPlayer1");
        } else if (barDataHorizontal[e] === "selectedPlayer2") {
            $(this).removeClass("colorNotSelected");
            $(this).addClass("colorSelectedPlayer2");
        }
    });
    $(".barVertical").each(function (e) {
        if (barDataVertical[e] === "notSelected") {
            $(this).removeClass("colorSelectedPlayer1");
            $(this).removeClass("colorSelectedPlayer2");
            $(this).addClass("colorNotSelected");
        } else if (barDataVertical[e] === "selectedPlayer1") {
            $(this).removeClass("colorNotSelected");
            $(this).addClass("colorSelectedPlayer1");
        } else if (barDataVertical[e] === "selectedPlayer2") {
            $(this).removeClass("colorNotSelected");
            $(this).addClass("colorSelectedPlayer2");
        }
    });
    $(".playerScore").each(function (e) {
        $(this).text(currentScore[e]);
    });

    // ここでcss操作で背景色つける
    $(".gameMainWindow").removeClass("colorSelectedPlayer1");
    $(".gameMainWindow").removeClass("colorSelectedPlayer2");
    const color = paintColor(currentPlayer);
    $(".gameMainWindow").addClass(color);

    // このターンのプレイヤーがどっちかを判定、このブラウザを開いているほうか判定
    if (currentPlayer[0] === isEntry[0] && currentPlayer[1] === isEntry[1]) {
        isTurnPlayer = true;
    } else {
        isTurnPlayer = false;
    }
    for (let i = 0; i < isEntry.length; i++) {
        if (currentPlayer[i] === true) {
            $(".currentPlayerName").text(playerName[i])
        }
    }

    // スコアの合計点が最大値ならゲーム終了の処理
    const sumScore = currentScore[0] + currentScore[1];
    // ブロック数と列数行数で変動するので変数で計算
    const allBlockCount = gridRows * gridCols;
    if (sumScore === allBlockCount) {
        // 得点の大きいほうが勝者として表示される
        if (currentScore[0] > currentScore[1]) {
            $("#popupWindow").css('display', 'block');
            $(".winnersName").text(playerName[0]);
        } else {
            $("#popupWindow").css('display', 'block');
            $(".winnersName").text(playerName[1]);
        }
    }
});

// プレイヤーの情報が更新されたとき
const qPlayers = query(collection(db, "players"), orderBy("time", "desc"));
onSnapshot(qPlayers, (querySnapshot) => {

    // firestore 形式のデータである querySnapshot.docs を入力する
    const documents = dataDocuments(querySnapshot.docs);
    isPlayers = documents[0].data.isPlayers;
    playerName = documents[0].data.name;
    $(".playerName").each(function (e) {
        $(this).text(playerName[e]);
    });

    // 操作順番がどちらなのかを判定
    // currentPlayer はサーバーから持ってきた情報[true,false]のように二つある
    // isEntry はローカルでプレイヤー0番か1番どっちに座ってるかでこちらも[true,false]
    // まったく一緒なら操作順番がこのブラウザーで開いてる側の人だと確定する
    if (currentPlayer[0] === isEntry[0] && currentPlayer[1] === isEntry[1]) {
        isTurnPlayer = true;
    } else {
        isTurnPlayer = false;
    }

    // ターンプレイヤーに応じて背景色変更
    if (currentPlayer[0]) {
        $(".gameMainWindow").removeClass("colorSelectedPlayer2");
        $(".gameMainWindow").addClass("colorSelectedPlayer1");
    } else {
        $(".gameMainWindow").removeClass("colorSelectedPlayer1");
        $(".gameMainWindow").addClass("colorSelectedPlayer2");
    }
    for (let i = 0; i < isEntry.length; i++) {
        if (currentPlayer[i] === true) {
            $(".currentPlayerName").text(playerName[i])
        }
    }
});

// ゲーム終了時に出るWindowをクリックしたときの処理
// 情報リセットして念のため画面更新
$("#popupWindow").on('click', async function () {
    $("#popupWindow").css('display', 'none');
    await gameReset();
    location.reload();
})


// ------------------------------
// 関数まとめ
// ------------------------------

// 「Firestore 形式のデータ」を入力して「配列形式のデータ」を出力する関数を追加する
function dataDocuments(fireStoreDocs) {
    const documents = [];
    fireStoreDocs.forEach(function (doc) {
        const document = {
            id: doc.id,
            data: doc.data(),
        };
        documents.push(document);
    });
    return documents;
}

// ブロックの周囲を確認して囲われたかチェックする
// barをクリックしたときのみ動作する isTurnPlayerがtrue の時のみ処理されることになるので
// 返り値でisTurnPlayerにtrueかfalseを入れなおす処理に変更します
function blockCheck() {
    let returnBoolean = false;
    for (let i = 0; i < blockData.length; i++) {
        // ブロックを全部チェックしていく
        // 周囲の棒の番号は
        // 上 i,下 i+5,左 i+(i/5の整数部分),右 i+(i/5の整数部分)+1
        const index = {
            top: i,
            bottom: i + gridRows,
            left: i + (Math.floor(i / gridRows)),
            right: i + (Math.floor(i / gridRows)) + 1
        }
        // ブロックがまだ変化してないところだけチェックする
        if (blockData[i] === "notSelected") {
            if (barDataHorizontal[index.top] !== "notSelected"
                && barDataHorizontal[index.bottom] !== "notSelected"
                && barDataVertical[index.left] !== "notSelected"
                && barDataVertical[index.right] !== "notSelected") {
                blockData[i] = selectPlayerCheck(isEntry);
                // ここでブロックがどちらかの得点になることが確定しているのでここで加算する
                if (blockData[i] === "selectedPlayer1") {
                    currentScore[0]++;
                } else {
                    currentScore[1]++;
                }
                // 新しくブロックに色が付いた時は引き続き操作できる
                returnBoolean = true;
            }
        }
    }

    // ブロックの状態を調べて色を付ける
    $(".block").each(function (e) {
        if (blockData[e] !== "notSelected") {
            $(this).removeClass("colorNotSelected");
            if (blockData[e] === "selectedPlayer1") {
                $(this).addClass("colorSelectedPlayer1");
            } else if (blockData[e] === "selectedPlayer2") {
                $(this).addClass("colorSelectedPlayer2");
            }
        }
    });

    // ブロック更新が入ってたらtrue,更新がなければfalseで返す
    return returnBoolean;
}

// プレイヤーの着席情報から着色する色を決めてクラス名を返す
function paintColor(arrayBoolean) {
    const className = ["colorSelectedPlayer1", "colorSelectedPlayer2"]
    for (let i = 0; i < arrayBoolean.length; i++) {
        if (arrayBoolean[i]) {
            return className[i];
        }
    }
}

// プレイヤーの着席情報からどちらのプレイヤーに選ばれたかを判定し、管理用のテキストデータで返す
function selectPlayerCheck(arrayBoolean) {
    const selectText = ["selectedPlayer1", "selectedPlayer2"]
    for (let i = 0; i < arrayBoolean.length; i++) {
        if (arrayBoolean[i]) {
            return selectText[i];
        }
    }
}

// 各種情報をリセットして最初からに戻す処理
// リセットボタンクリック時と、ゲームクリア時に行います
async function gameReset() {
    // サーバーに全部初期値のデータを保存すると最新データがリセットされたことになる
    // 全部初期値にする
    // ブロック関係の情報
    for (let i = 0; i < blockData.length; i++) {
        blockData[i] = "notSelected";
    }
    for (let i = 0; i < barDataHorizontal.length; i++) {
        barDataHorizontal[i] = "notSelected";
    }
    for (let i = 0; i < barDataVertical.length; i++) {
        barDataVertical[i] = "notSelected";
    }
    for (let i = 0; i < currentScore.length; i++) {
        currentScore[i] = 0;
    }

    // カラー情報を初期化
    $(".block").each(function (e) {
        $(this).removeClass("colorSelectedPlayer1");
        $(this).removeClass("colorSelectedPlayer2");
        $(this).addClass("colorNotSelected");
    });
    $(".barHorizontal").each(function (e) {
        $(this).removeClass("colorSelectedPlayer1");
        $(this).removeClass("colorSelectedPlayer2");
        $(this).addClass("colorNotSelected");
    });
    $(".barVertical").each(function (e) {
        $(this).removeClass("colorSelectedPlayer1");
        $(this).removeClass("colorSelectedPlayer2");
        $(this).addClass("colorNotSelected");
    });

    // サーバーに送るデータを整理
    const postData = {
        block: blockData,
        horizontal: barDataHorizontal,
        vertical: barDataVertical,
        turnPlayer: currentPlayer,
        score: currentScore,
        time: serverTimestamp()
    }
    await setDoc(doc(db, "data", dataID), postData);

    // プレイヤー関係の情報
    for (let i = 0; i < isPlayers.length; i++) {
        isPlayers[i] = false;
        // ついでにローカルプレイヤーの着席判定も消しちゃう
        isEntry[i] = false;
    }

    // 表示をリセット
    $(".playerName").each(function (e) {
        $(this).text('');
        playerName[e] = "";
    })

    // サーバーに送るデータ整理
    const postPlayerData = {
        isPlayers: isPlayers,
        name: playerName,
        time: serverTimestamp()
    }
    await setDoc(doc(db, "players", playerID), postPlayerData);
}