const express = require('express');
const SteamCommunity = require('steamcommunity');
const SteamTotp = require('steam-totp');
const app = express()
const port = 8888;
const bodyParser = require('body-parser');
const cheerio = require('cheerio');
const fs = require('fs');
const dayjs = require('dayjs');

// 解析 application/x-www-form-urlencoded 格式的数据
app.use(bodyParser.urlencoded({ extended: false }));
// 解析 application/json 格式的数据
app.use(bodyParser.json());

let userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:137.0) Gecko/20100101 Firefox/137.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.60 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.41 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.5112.102 Safari/537.36'
]

function rand(start, end) {
    let r = Math.random();
    return Math.floor(r * (end - start + 1)) + start;
}


SteamCommunity.prototype.flushAll = function (sessionID, cookies) {
    this.httpRequestPost({
        "uri": "https://store.steampowered.com/twofactor/manage_action",
        "formData": {
            "action": 'deauthorize',
            "sessionid": sessionID
        },
    }, function (err, resposne, body) {
        // console.log(resposne);
        if (err) {
            console.log("flush err")
            // console.log(err);
        } else {
            console.log("flush success", sessionID)
            this.httpRequestPost({
                uri: 'https://store.steampowered.com/logout',
                form: {
                    sessionid: sessionID
                },
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }, function (err) {
                if (err) {
                    console.log("logout error")
                } else {
                    console.log("logout success");
                }
            })

        }

    }
    )
};


SteamCommunity.prototype.cs2_info = async function (steamId) {
    console.log(2222);
    // https://steamcommunity.com/profiles/76561198146905562/gcpd/730/
    let promise1 = new Promise((resolve, reject) => {
        this.httpRequestGet({
            "uri": `https://steamcommunity.com/profiles/${steamId}/gcpd/730/`,
        }, function (err, resposne, body) {
            if (!err) {

                let $ = cheerio.load(body);
                let res = $("#personaldata_elements_container").find('.generic_kv_table').last();

                let rank = res.find('div').eq(2).text();
                let point = res.find('div').eq(3).text();
                rank = rank.trim();
                point = point.trim();
                let rankMatch = rank.match(/(\d+)/);
                let pointMatch = point.match(/(\d+)/);
                // console.log(rankMatch[0], pointMatch[0])
                resolve({ rank: +rankMatch[0], point: +pointMatch[0] })
            } else {
                console.log(err);
                reject();
            }

        }, 'steamcommunity'
        )
    })

    let promise2 = new Promise((resolve, reject) => {
        this.httpRequestGet({
            uri: `https://steamcommunity.com/profiles/${steamId}/gcpd/730/?tab=operationquests`
        }, function (err, response, body) {
            if (!err) {
                let $ = cheerio.load(body);
                let res = $("#personaldata_elements_container").find('.generic_kv_table').last();
                let star = 0;
                let passport_num = 0;
                if (res.length > 0) {
                    let trContainer = res.find('tr').eq(1);
                    let currentStar = trContainer.find('td').eq(0).text();
                    passport_num = trContainer.find('td').eq(2).text();

                    // console.log(currentStar);
                    let startMatch = currentStar.match(/(\d+)/);

                    if (startMatch) star = +startMatch[0]
                }

                resolve({ star: star, passport_num: passport_num });

            } else {
                console.log(err);
                reject();
            }
        }, 'steamcommunity')
    })

    let promise3 = new Promise((resolve, reject) => {
        this.httpRequestGet({
            uri: `https://steamcommunity.com/profiles/${steamId}/inventoryhistory/?app%5B%5D=730`
        }, function (err, response, body) {
            if (!err) {
                // console.log(body);
                // fs.writeFileSync("3.html",body);
                let $ = cheerio.load(body);
                let time = false;
                if ($("#inventory_history_table").find('div').length <= 0) {
                    resolve({ last_drop_time: false })
                } else {
                    $("#inventory_history_table").find('div').each((i, item) => {
                        let text = $(item).find('.tradehistory_event_description').text();
                        text = text.trim();
                        // console.log(text);
                        if (text === 'Earned a new rank and got a drop') {
                            //获取时间

                            let t = $(item).children(".tradehistory_date").contents().first().text().trim();
                            let t2 = $(item).find(".tradehistory_timestamp").text().trim();
                            console.log(t, t2);
                            let date1 = dayjs(t).format("YYYY-MM-DD");
                            let date2 = t2.slice(0, t2.length - 2);
                            let last_drop_time = `${date1} ${date2}:00`;
                            let unix = dayjs(last_drop_time).unix();
                            unix = unix + 3600 * 8;
                            if (t2.includes('am')) {
                            } else {
                                unix = unix + 86400 / 2;


                            }
                            let tmp = dayjs(unix * 1000).format('YYYY-MM-DD HH:mm:ss');
                            resolve({
                                last_drop_time: tmp
                            })
                            // break;

                        }
                    })
                    resolve({ last_drop_time: false })
                }


            } else {
                console.log(err);
                reject();
            }
        }, 'steamcommunity')
    })
    
    let [rankInfo, startInfo, lastDropInfo] = await Promise.all([promise1, promise2, promise3]);

    return {
        rank: rankInfo.rank,
        point: rankInfo.point,
        star: startInfo.star,
        passport_num: startInfo.passport_num,
        last_drop_time: lastDropInfo.last_drop_time
    }


};

SteamCommunity.prototype.isLoginIn = async function () {
    return new Promise((resolve, reject) => {
        this.loggedIn(async (err, status) => {
            if (!err) {
                if (status) {
                    resolve(true)
                } else {
                    resolve(false);
                }
            } else {
                resolve(false);
            }
        })
    })
}


app.post('/rent_logout', (req, res) => {
    let now = new Date();
    now = now.toLocaleString('zh-cn');
    console.log(now, req.body);
    let account = req.body.account;
    let password = req.body.password;
    let guard = req.body.guard;
    if (!account || !password || !guard) {
        res.json({ code: 1, message: '参数不全' })
    } else {
        let steamObj = new SteamCommunity();
        steamObj.login({
            accountName: account,
            password: password,
            twoFactorCode: guard
        }, (err, sessionId) => {
            if (err) {
                console.log("login error", err);
                res.json({ code: 1, message: "STEAM登录错误" })
            } else {
                if (sessionId && typeof sessionId == 'string' && sessionId.includes(';')) {
                    sessionId = sessionId.split(';')[0];
                }
                console.log("login success", sessionId);
                setTimeout(() => {
                    steamObj.flushAll(sessionId);
                }, 1000);

                res.json({ code: 0, message: "success" })
            }

        })
    }

})

/**
 * 采集武库信息
 */
app.post('/game_info', async (req, res) => {
    let now = new Date();
    now = now.toLocaleString('zh-cn');
    console.log(now, req.body);
    let account = req.body.account;
    let password = req.body.password;
    let guard = req.body.guard;
    let cookie = req.body.cookie;
    if (!account || !password || !guard) {
        res.send({ code: 1, message: "参数不全" });
        return;
    }

    // guard = SteamTotp.generateAuthCode(guard);
    let userAgent = userAgents[rand(0, userAgents.length - 1)];
    let steamObj = new SteamCommunity({
        userAgent: userAgent
    });


    let status = false;
    if (cookie) {
        //
        console.log("尝试使用cookie登录")
        steamObj.setCookies(cookie);
        try {
            status = await steamObj.isLoginIn();
        } catch (err) {
            console.log("catch err", err);
        }

        if (status) {
            let steamId = steamObj.steamID.toString();
            let info = await steamObj.cs2_info(steamId);
            res.json({ code: 0, data: info });
        } else {
            console.log("cookie过期,使用账号密码登录");
        }
    }

    if (!cookie || !status) {
        console.log("账号密码登录");
        steamObj.login({
            accountName: account,
            password: password,
            twoFactorCode: guard
        }, async (err, sessionId, cookies) => {
            if (err) {
                console.log("登录错误", err);
                res.json({ code: 1, message: 'STEAM登录失败' });
            } else {
                console.log("登录成功=====>")
                let steamId = steamObj.steamID.toString();
                try {
                    let info = await steamObj.cs2_info(steamId);
                    info.cookie = cookies
                    res.json({ code: 0, data: info });
                } catch (err) {
                    console.log(err);
                }


            }
        })
    }
})

app.all('/info', (req, res) => {
    console.log("请求方法:", req.method)
    console.log("URL:", req.url)
    console.log("HEADERS:", req.headers)
    console.log("请求体:", req.body)
    res.send("success");
})

app.get('/status', (req, res) => {
    res.send("success");
})

app.get('/', (req, res) => {
    res.json({ code: 0, message: 'success' });
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})