// firebase読み込み
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    deleteDoc,
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

// 固定値
const constant = {
    blockHorizontal: 5,
    blockVertical: 3
}

// 管理用 データとしてサーバーにも載せるもの
let barDataVertical = [];
let barDataHorizontal = [];
let blockData = [];
let currentPlayer = [true, false];
let currentScore = [0, 0];

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

// ------------------------------
// 画面の初期描画処理
// ------------------------------

// ブロック描画 横列ごとにグループ化して並べる 
// $("#blockSpace").html()の中身を作成する
let blockDataHtml = "";
for (let i = 0; i < constant.blockVertical; i++) {
    blockDataHtml += `<div class="blockHorizontalGroup">`;
    for (let i2 = 0; i2 < constant.blockHorizontal; i2++) {
        blockDataHtml += `<div class="block colorNotSelected"></div>`;
        // ブロックの状態を管理
        blockData.push("notSelected");
    }
    blockDataHtml += `</div>`;
}
$("#blockSpace").html(blockDataHtml);

// 縦横それぞれのhtmlの中身を作成
// ブロック数と列数行数で変動するので変数で計算
const allBlockCount = constant.blockHorizontal * constant.blockVertical;
let barHorizontalHtml = "";
let barVerticalHtml = "";
for (let i = 0; i < (allBlockCount + constant.blockHorizontal); i++) {
    barHorizontalHtml += `<div class="barHorizontal colorNotSelected"></div>`;
    barDataHorizontal[i] = "notSelected";
}
$("#barHorizontalGroup").html(barHorizontalHtml);
for (let i = 0; i < (allBlockCount + constant.blockVertical); i++) {
    barVerticalHtml += `<div class="barVertical colorNotSelected"></div>`;
    barDataVertical[i] = "notSelected";
}
$("#barVerticalGroup").html(barVerticalHtml);

// 各ブロックの座標を獲得
let blockPos = [];
// ブロックの周囲を囲む縦横の棒の管理
// 横向きの棒
let barHorizontalPos = [];
// 縦向きの棒
let barVerticalPos = [];
$(".block").each(function (e) {
    // ブロックの座標を取得
    blockPos[e] = $(this).offset();
    $(this).html(`<p>${e}番目ブロック</p>`);
    // 横向き棒の座標をブロック座標から計算して設定
    // Object.assign({}, blockPos[e])じゃないと参照したオブジェクト情報書き換えちゃうらしい
    barHorizontalPos[e] = Object.assign({}, blockPos[e]);
    barHorizontalPos[e].top -= $(".barHorizontal").outerHeight();
    barHorizontalPos[e + constant.blockHorizontal] = Object.assign({}, blockPos[e]);
    barHorizontalPos[e + constant.blockHorizontal].top += $(".block").outerHeight();
    // 縦向き
    barVerticalPos[e + (Math.floor(e / constant.blockHorizontal))] = Object.assign({}, blockPos[e]);
    barVerticalPos[e + (Math.floor(e / constant.blockHorizontal))].left -= $(".barVertical").outerWidth();
    barVerticalPos[e + (Math.floor(e / constant.blockHorizontal)) + 1] = Object.assign({}, blockPos[e]);
    barVerticalPos[e + (Math.floor(e / constant.blockHorizontal)) + 1].left += $(".block").outerWidth();
});
// 計算した座標に配置する
$(".barHorizontal").each(function (e) {
    $(this).offset(barHorizontalPos[e]);
});
$(".barVertical").each(function (e) {
    $(this).offset(barVerticalPos[e]);
});

// ------------------------------
// クリックされたときの動作
// ------------------------------

// クリックされたときにクラスの付け替えで色を変える
// あとからプレイヤーどっちの操作なのかで色など変更する
// 横向きの処理
$(".barHorizontal").on('click', function () {
    // 捜査権限があるときだけ処理を行う
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
            } else {
                // 操作権残ってる＝得点してるということで得点処理
                // for (let i = 0; i < isEntry.length; i++) {
                //     // ローカルのプレイヤ番号がtrueの時同じ番号がtrueになってたということ
                //     // 同じ番号のcurrentPlayerをfalseにする
                //     // ローカルのプレイヤ番号がfalseの時同じ番号がtrueに変わることで相手の操作順に変わったということ
                //     if (isEntry[i] === true) {
                //         currentScore[i]++;
                //     }
                // }
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
            addDoc(collection(db, "data"), postData);
        }
    }
});

// 縦向きの処理
$(".barVertical").on('click', function () {
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
            } else {
                // 操作権残ってる＝得点してるということで得点処理
                // ２マス同時に埋まることがあるのでブロックCheck関数に処理を移動します
                // for (let i = 0; i < isEntry.length; i++) {
                //     // ローカルのプレイヤ番号がtrueの時同じ番号がtrueになってたということ
                //     // 同じ番号のcurrentPlayerをfalseにする
                //     // ローカルのプレイヤ番号がfalseの時同じ番号がtrueに変わることで相手の操作順に変わったということ
                //     if (isEntry[i] === true) {
                //         currentScore[i]++;
                //     }
                // }
            }
            const postData = {
                block: blockData,
                horizontal: barDataHorizontal,
                vertical: barDataVertical,
                turnPlayer: currentPlayer,
                score: currentScore,
                time: serverTimestamp()
            }
            addDoc(collection(db, "data"), postData);
        }
    }
});

// ------------------------------
// UI操作関連
// ------------------------------

// 離着席処理
// entry
$(".entryButton").on('click', function () {
    const index = $(".entryButton").index(this);
    if (!isPlayers[index] && isEntry.every(v => !v)) {
        isEntry[index] = true;
        isPlayers[index] = true;
        console.log("isPlayers[index]", isPlayers[index]);
        const parentBox = $(this).closest(".userInterfaceBox");
        playerName[index] = parentBox.find("input[type=text]").val();
        parentBox.find(".playerName").text(playerName[index]);
        // サーバーに情報保存
        const postData = {
            isPlayers: isPlayers,
            name: playerName,
            time: serverTimestamp()
        }
        addDoc(collection(db, "players"), postData);
    }
});

// exit
$(".exitButton").on('click', function () {
    const index = $(".exitButton").index(this);
    if (isPlayers[index] && isEntry[index]) {
        isEntry[index] = false;
        isPlayers[index] = false;
        console.log("isPlayers[index]", isPlayers[index]);
        const parentBox = $(this).closest(".userInterfaceBox");
        playerName[index] = "";
        parentBox.find(".playerName").text("");
        // サーバーに情報保存
        const postData = {
            isPlayers: isPlayers,
            name: playerName,
            time: serverTimestamp()
        }
        addDoc(collection(db, "players"), postData);
    }
});

// リセットボタン操作
// いったん$("#common")をリセットボタンとする
$("#common").on('click', function () {
    // すべてのデータを初期値に戻して上書きする処理を、ゲーム終了時にも動作させるので
    // 内部処理を全部関数にまとめました
    gameReset();

    // // サーバーに全部初期値のデータを保存すると最新データがリセットされたことになる
    // // 全部初期値にする
    // // ブロック関係の情報
    // for (let i = 0; i < blockData.length; i++) {
    //     blockData[i] = "notSelected";
    // }
    // for (let i = 0; i < barDataHorizontal.length; i++) {
    //     barDataHorizontal[i] = "notSelected";
    // }
    // for (let i = 0; i < barDataVertical.length; i++) {
    //     barDataVertical[i] = "notSelected";
    // }
    // for (let i = 0; i < currentScore.length; i++) {
    //     currentScore[i] = 0;
    // }
    // $(".block").each(function (e) {
    //     $(this).removeClass("colorSelectedPlayer1");
    //     $(this).removeClass("colorSelectedPlayer2");
    //     $(this).addClass("colorNotSelected");
    // });
    // $(".barHorizontal").each(function (e) {
    //     $(this).removeClass("colorSelectedPlayer1");
    //     $(this).removeClass("colorSelectedPlayer2");
    //     $(this).addClass("colorNotSelected");
    // });
    // $(".barVertical").each(function (e) {
    //     $(this).removeClass("colorSelectedPlayer1");
    //     $(this).removeClass("colorSelectedPlayer2");
    //     $(this).addClass("colorNotSelected");
    // });
    // console.log("すべてのブロックと棒をnotSelectedに変更してカラークラスも変更");
    // const postData = {
    //     block: blockData,
    //     horizontal: barDataHorizontal,
    //     vertical: barDataVertical,
    //     turnPlayer: currentPlayer,
    //     score: currentScore,
    //     time: serverTimestamp()
    // }
    // addDoc(collection(db, "data"), postData);
    // // プレイヤー関係の情報
    // for (let i = 0; i < isPlayers.length; i++) {
    //     isPlayers[i] = false;
    //     // ついでにローカルプレイヤーの着席判定も消しちゃう
    //     isEntry[i] = false;
    // }
    // // 表示をリセット
    // $(".playerName").each(function (e) {
    //     $(this).text('');
    //     playerName[e] = "";
    // })
    // const postPlayerData = {
    //     isPlayers: isPlayers,
    //     name: playerName,
    //     time: serverTimestamp()
    // }
    // addDoc(collection(db, "players"), postPlayerData);
})

// ------------------------------
// データ更新時の処理
// ------------------------------

const q = query(collection(db, "data"), orderBy("time", "desc"));
onSnapshot(q, (querySnapshot) => {
    // firestore 形式のデータである querySnapshot.docs を入力する
    const documents = dataDocuments(querySnapshot.docs);
    // 古いデータ消す
    for (let i = 1; i < documents.length; i++) {
        deleteDoc(doc(db, "data", documents[i].id));
    }
    console.log(documents);
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

    console.log("currentPlayer", currentPlayer);
    console.log("isEntry", isEntry);
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
    console.log("isTurnPlayer", isTurnPlayer);

    // スコアの合計点が最大値ならゲーム終了の処理
    const sumScore = currentScore[0] + currentScore[1];
    if (sumScore === allBlockCount) {
        // 得点の大きいほうが勝者として表示される
        if (currentScore[0] > currentScore[1]) {
            $("#popupWindow").css('display', 'block');
            $("#winnersName").text(playerName[0]);
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
    // 古いデータ消す
    for (let i = 1; i < documents.length; i++) {
        deleteDoc(doc(db, "players", documents[i].id));
    }
    console.log(documents);
    isPlayers = documents[0].data.isPlayers;
    playerName = documents[0].data.name;
    $(".playerName").each(function (e) {
        $(this).text(playerName[e]);
    });
    // 操作順番がどちらなのかを判定
    // currentPlayer はサーバーから持ってきた情報[true,false]のように二つある
    // isEntry はローカルでプレイヤー0番か1番どっちに座ってるかでこちらも[true,false]
    // まったく一緒なら操作順番がこのブラウザーで開いてる側の人だと確定する
    console.log("currentPlayer", currentPlayer);
    console.log("isEntry", isEntry);
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
    console.log("isTurnPlayer", isTurnPlayer);
});

// ゲーム終了時に出るWindowをクリックしたときの処理
// 情報リセットして念のため画面更新
$("#popupWindow").on('click', function () {
    gameReset();
    // resetが早すぎるとデータのクリアが間に合わないのかもということで遅らせます
    setTimeout(function () {
        location.reload();
    }, 2000)
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
    console.log("blockCheck()処理");
    let returnBoolean = false;
    for (let i = 0; i < blockData.length; i++) {
        // ブロックを全部チェックしていく
        // 周囲の棒の番号は
        // 上 i,下 i+5,左 i+(i/5の整数部分),右 i+(i/5の整数部分)+1
        const index = {
            top: i,
            bottom: i + constant.blockHorizontal,
            left: i + (Math.floor(i / constant.blockHorizontal)),
            right: i + (Math.floor(i / constant.blockHorizontal)) + 1
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
                console.log("blockData[i]が'selectedPlayer1', 'selectedPlayer2'に変更されました i:" + i);
                // 新しくブロックに色が付いた時は引き続き操作できる
                returnBoolean = true;
            }
        }
    }
    console.log("すべてのブロックをチェック終了");
    $(".block").each(function (e) {
        if (blockData[e] !== "notSelected") {
            $(this).removeClass("colorNotSelected");
            if (blockData[e] === "selectedPlayer1") {
                $(this).addClass("colorSelectedPlayer1");
            } else if (blockData[e] === "selectedPlayer2") {
                $(this).addClass("colorSelectedPlayer2");
            }
            console.log("ブロックNo:" + e + " 番目のカラー変更");
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
function gameReset() {
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
    console.log("すべてのブロックと棒をnotSelectedに変更してカラークラスも変更");
    const postData = {
        block: blockData,
        horizontal: barDataHorizontal,
        vertical: barDataVertical,
        turnPlayer: currentPlayer,
        score: currentScore,
        time: serverTimestamp()
    }
    addDoc(collection(db, "data"), postData);
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
    const postPlayerData = {
        isPlayers: isPlayers,
        name: playerName,
        time: serverTimestamp()
    }
    addDoc(collection(db, "players"), postPlayerData);
}