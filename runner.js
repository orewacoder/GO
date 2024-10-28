require('dotenv').config();
const newman = require('newman');
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const minimist = require('minimist');
const { exec } = require('child_process');

const args = minimist(process.argv.slice(2));
const telegramToken = process.env.TELEGRAM_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;
const collectionName = process.argv[2];

const header = "Идёт тестирование\n";
let finishedItems = [];
let messageId = null;

const runCollection = () => {
  newman.run({
    collection: require(`./collections/${collectionName}.json`),
    reporters: ['cli', 'allure'],
    reporter: {
      allure: {
        export: './allure-results'
      }
    },
    delayRequest: 150
  }, async function (err, summary) {
    if (err) { throw err; }
    let totalMethods = summary.run.stats.requests.total;
    let passedTests = summary.run.stats.assertions.total - summary.run.stats.assertions.failed;
    let failedTests = summary.run.stats.assertions.failed;
    let collectionName = summary.collection.name;

    const messageText = `Тестирование завершено.\nНазвание коллекции: ${collectionName}\nВсего методов: ${totalMethods}\nУспешные тесты: ${passedTests}\nПроваленные тесты: ${failedTests}`;

    // Generate Allure report
    exec('allure generate --single-file ./allure-results --clean -o ./allure-report', async (error, stdout, stderr) => {
      if (error) {
        console.error(`Ошибка генерации отчета Allure: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`Ошибка генерации отчета Allure: ${stderr}`);
        return;
      }
      console.log(`Отчет Allure сгенерирован: ${stdout}`);
      await createAndSendChart(passedTests, failedTests, collectionName, Boolean(!failedTests));
      await sendReport('./allure-report/index.html', messageText, Boolean(!failedTests));
    });
  });
};

const sendReport = async (filePath, messageText, disableNotification) => {
  console.log(`Attempting to send report from: ${filePath}`);
  const formData = new FormData();
  formData.append('chat_id', telegramChatId);
  formData.append('document', fs.createReadStream(filePath));
  formData.append('disable_notification', String(disableNotification));

  try {
    const response = await fetch(`https://api.telegram.org/bot${telegramToken}/sendDocument`, {
      method: 'POST',
      body: formData,
    });
    const json = await response.json();
    console.log(json);
    if (!json.ok) {
      throw new Error(`Ошибка отправки файла: ${json.description}`);
    }
    sendMessage(messageText, disableNotification);
  } catch (err) {
    console.error(err.message);
  }
};

const sendMessage = async (messageText, disableNotification) => {
  try {
    const response = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: messageText,
        disable_notification: disableNotification
      })
    });
    const json = await response.json();
    if (!json.ok) {
      throw new Error(`Ошибка отправки текстового сообщения: ${json.description}`);
    }
    messageId = json.result.message_id;
  } catch (err) {
    console.error(err.message);
  }
};


const editMessage = async (messageText, messageId, disableNotification) => {
    console.log("Edit message");
    try {
      const response = await fetch(`https://api.telegram.org/bot${telegramToken}/editMessageText`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chat_id: telegramChatId,
          message_id: messageId,
          text: messageText,
          disable_notification: disableNotification
        })
      });
      const json = await response.json();
      if (!json.ok) {
        throw new Error(`Ошибка редактирование текстового сообщения: ${json.description}`);
      }
      console.log(json);
    } catch (err) {
      console.error(err.message);
    }
  };
  
  async function createAndSendChart(passedTests, failedTests, collectionName, disableNotification) {
    const chartConfig = {
      type: 'doughnut',
      "options": {
      "title": {
        "display": true,
        "position": "top",
        "fontSize": 22,
        "fontFamily": "sans-serif",
        "fontColor": "#666666",
        "fontStyle": "bold",
        "padding": 10,
        "lineHeight": 1.1,
        text: `${collectionName}`,
      },
      "layout": {
        "padding": {},
        "left": 0,
        "right": 0,
        "top": 0,
        "bottom": 0
      },
      "legend": {
        "display": true,
        "position": "top",
        "align": "center",
        "fullWidth": true,
        "reverse": false,
        "labels": {
          "fontSize": 12,
          "fontFamily": "sans-serif",
          "fontColor": "#666666",
          "fontStyle": "bold",
          "padding": 10
        }
      },
      "scales": {
        "xAxes": [
          {
            "id": "X1",
            "display": false,
            "position": "bottom",
            "type": "linear",
            "stacked": false,
            "offset": false,
            "time": {
              "unit": false,
              "stepSize": 1,
              "displayFormats": {
                "millisecond": "h:mm:ss.SSS a",
                "second": "h:mm:ss a",
                "minute": "h:mm a",
                "hour": "hA",
                "day": "MMM D",
                "week": "ll",
                "month": "MMM YYYY",
                "quarter": "[Q]Q - YYYY",
                "year": "YYYY"
              }
            },
            "distribution": "linear",
            "gridLines": {
              "display": true,
              "color": "rgba(0, 0, 0, 0.1)",
              "borderDash": [
                0,
                0
              ],
              "lineWidth": 1,
              "drawBorder": true,
              "drawOnChartArea": true,
              "drawTicks": true,
              "tickMarkLength": 10,
              "zeroLineWidth": 1,
              "zeroLineColor": "rgba(0, 0, 0, 0.25)",
              "zeroLineBorderDash": [
                0,
                0
              ]
            },
            "angleLines": {
              "display": true,
              "color": "rgba(0, 0, 0, 0.1)",
              "borderDash": [
                0,
                0
              ],
              "lineWidth": 1
            },
            "pointLabels": {
              "display": true,
              "fontColor": "#666",
              "fontSize": 10,
              "fontStyle": "normal"
            },
            "ticks": {
              "display": true,
              "fontSize": 12,
              "fontFamily": "sans-serif",
              "fontColor": "#666666",
              "fontStyle": "normal",
              "padding": 0,
              "stepSize": null,
              "minRotation": 0,
              "maxRotation": 50,
              "mirror": false,
              "reverse": false
            },
            "scaleLabel": {
              "display": true,
              "labelString": "Axis label",
              "lineHeight": 1.2,
              "fontColor": "#666666",
              "fontFamily": "sans-serif",
              "fontSize": 12,
              "fontStyle": "normal",
              "padding": 4
            }
          }
        ],
        "yAxes": []
      },
      "plugins": {
        "datalabels": {
          "display": true,
          "align": "center",
          "anchor": "center",
          "backgroundColor": "#eee",
          "borderColor": "#ffffff",

          "borderRadius": 2,
          "borderWidth": 0,
          "padding": 4,
          "color": "#666666",
          "font": {
            "family": "sans-serif",
            "size": 10,
            "style": "italic"
          }
        },
        "datalabelsZAxis": {
          "enabled": false
        },
        "googleSheets": {},
        "airtable": {},
        "tickFormat": ""
      },
      "cutoutPercentage": 80,
      "rotation": -1.5707963267948966,
      "circumference": 6.283185307179586,
      "startAngle": -1.5707963267948966
    },
  
      data: {
        labels: ['Успешные тесты', 'Проваленные тесты'],
        datasets: [{
          data: [passedTests != 0 ? passedTests : null, failedTests != 0 ? failedTests : null],
          backgroundColor: ["#74b857","#f22b49"],
          borderColor: "#ffffff",
          type: "doughnut",
          barPercentage: 0.9,
          categoryPercentage: 0.8,
          fill: true,
          spanGaps: false,
          lineTension: 0,
          pointRadius: 3,
          pointHoverRadius: 3,
          borderWidth: 1.2,
          hidden: false,
          xAxisID: "X1",
          yAxisID: null,
          pointStyle: "circle",
          borderDash: [
            0,
            0
          ],
        }]
      }
    };
    const encodedChartConfig = encodeURIComponent(JSON.stringify(chartConfig));
    const url = `https://quickchart.io/chart?c=${encodedChartConfig}&format=png`;
    console.log("Generated chart URL:", url);
    const response = await fetch(url);
    const imageBuffer = await response.buffer();
  
    fs.writeFileSync('chart.png', imageBuffer);
  
    await sendChartToTelegram('chart.png', disableNotification);
  }
  
  async function sendChartToTelegram(filePath, disableNotification) {
    console.log(`Attempting to send chart from: ${filePath}`);
    const formData = new FormData();
    formData.append('chat_id', telegramChatId);
    formData.append('photo', fs.createReadStream(filePath));
    formData.append('disable_notification', String(disableNotification));
  
    try {
      const response = await fetch(`https://api.telegram.org/bot${telegramToken}/sendPhoto`, {
        method: 'POST',
        body: formData
      });
      const json = await response.json();
      if (!json.ok) {
        throw new Error(`Ошибка отправки изображения: ${json.description}`);
      }
      console.log(json);
    } catch (err) {
      console.error(err.message);
    }
  }
  
  runCollection();


  module.exports = {
    runCollection
  };
  
    