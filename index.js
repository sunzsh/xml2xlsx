const fs = require('fs') 
const ExcelJS = require('exceljs')
const path = require("path")
const iconv = require('iconv-lite');
const jschardet = require('jschardet');
const parseString = require('xml2js').parseString;

const args = process.argv.slice(2);
if (!args || args.length == 0) {
    console.log('缺少参数！');
    process.exit(1);
}

function translateColumnName(num) {
    let columnName = '';
    do {
        let every = num % 26;
        columnName = String.fromCharCode(every + 64) + columnName;
        num -= every
        num = num / 26
    } while (num > 0)
    
    return columnName;
}
async function main() {
    args.forEach(filePath => {
        doConvert(filePath)
    });
}

function soildBorderForRow(row) {
    row._cells.forEach(cell => {
        cell.border = {
            top: {style:'thin'},
            left: {style:'thin'},
            bottom: {style:'thin'},
            right: {style:'thin'}
        };
    });
}

function buildTitle(sheet, array) {

    const columns = [];

    const existsInColumns = function(k) {
        return columns.findIndex((n) => n.key == k) >= 0;
    }

    array.forEach(item => {
        Object.keys(item).forEach(key => {
            if (existsInColumns(key)) {
                return;
            }
            columns.push({ header: key, key: key, width: 20 });
        });
    });
    sheet.columns = columns;

    const titleRow = sheet.getRow(1);
    titleRow.font = {  size: 14,  bold: true };
    titleRow.height = 30;
    titleRow.alignment = { vertical: 'middle', horizontal: 'center' };
    soildBorderForRow(titleRow);
}




async function doConvert(filePath) {
    let array = await readArray(filePath)
    if (!array || array.length == 0) {
        return ;
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet1', {views:[{xSplit: 1}]});
    buildTitle(sheet, array);
    
    array.forEach(item => {
        const row = sheet.addRow(item);
        row.font = {  size: 14 };
        row.alignment = { vertical: 'middle', horizontal: 'center' };
        row.height = 30;
        soildBorderForRow(row);
    });

    // 自动筛选器
    sheet.autoFilter = {
        from: 'A1',
        to: {
          row: 1,
          column: sheet.columns.length
        }
      }
    sheet.properties.defaultRowHeight = 30;

    // 设置条纹背景
    sheet.addConditionalFormatting({
        ref: `A1:${translateColumnName(sheet.columns.length)}${array.length}`,
        rules: [
            {
            type: 'expression',
            formulae: ['MOD(ROW(),2)=0'],
            style: {fill: {type: 'pattern', pattern: 'solid', bgColor: {argb: 'CECECE'}}},
            }
        ]
    })

    let xlsxFilePath = path.join(path.dirname(filePath), path.basename(filePath, ".txt") + ".xlsx", );
    console.log(`succeed to convert ${filePath} to ${xlsxFilePath}`);
    workbook.xlsx.writeFile(xlsxFilePath);

}


function readArray(filePath) {

    return new Promise((resolve, reject) => {
        if(!fs.existsSync(filePath)) {
            console.log(`文件不存在：${filePath}`);
            resolve(null);
        }
        var data = fs.readFileSync(filePath);
        let ret = jschardet.detect(data);
        var xml = iconv.decode(data,ret.encoding);
    
        // console.log(result);
    
        const resArray = [ ];
        parseString(xml, (err, result) => {
            if (err) {
                console.error(err);
                resolve(null);
                return;
            }
            const resArray = [ ];
            // console.log(result);

            var loadChildData = (data) => {
                if (data instanceof Array) {
                    for (const dItem of data) {
                        if (!dItem.$) {
                            loadChildData(dItem)
                        } else {
                            resArray.push(dItem.$)
                        }
                    }
                } else {
                    for (const dKey of Object.keys(data)) {
                        if (dKey === '$') {
                            continue;
                        }
                        loadChildData(data[dKey]);
                    }
                }
            }
            loadChildData(result);
            // console.log(resArray);
    
            // for (const row of result.Data.YKFP[0].Row) {
            //     resArray.push(row.$)
            // }
            // console.log(resArray);
    
            resolve(resArray);
        });
    });
}

main();