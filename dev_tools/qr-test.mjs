// 临时复测脚本:修复后 buildVCard(占位邮箱 + TITLE 逗号不转义)对 3 位真实联系人的输出。
// 运行:node dev_tools/qr-test.mjs → 生成 dev_tools/qr-test.html,微信扫码确认。
// 注:与生产 buildVCard 输出逐行一致(据数据与逻辑推演)。
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { writeFileSync } from 'node:fs'

const CRLF = '\r\n'

const persons = [
  {
    name: '余春莉',
    vcard: [
      'BEGIN:VCARD', 'VERSION:3.0', 'UID:iaao2pja8uykwrf',
      'N:余;春莉;;;', 'FN:余春莉',
      'TEL;TYPE=CELL,PREF:15087199524',
      'EMAIL;TYPE=INTERNET:EMAIL@信息.缺失',
      'GENDER:F', 'ORG:曲靖一中卓立学校', 'TITLE:办公室主任',
      'END:VCARD'
    ].join(CRLF)
  },
  {
    name: '刘怀权',
    vcard: [
      'BEGIN:VCARD', 'VERSION:3.0', 'UID:nvav6afek8dvzi7',
      'N:刘;怀权;;;', 'FN:刘怀权',
      'TEL;TYPE=CELL,PREF:15288092666',
      'EMAIL;TYPE=INTERNET:EMAIL@信息.缺失',
      'GENDER:M', 'ORG:曲靖一中卓立学校',
      'TITLE:副校长,,八级管理',
      'CATEGORIES:曲靖,曲靖经开区,科教文卫',
      'END:VCARD'
    ].join(CRLF)
  },
  {
    name: '冯利军',
    vcard: [
      'BEGIN:VCARD', 'VERSION:3.0', 'UID:7sd8mnwlbetr3k0',
      'N:冯;利军;;;', 'FN:冯利军',
      'TEL;TYPE=CELL,PREF:13099863231',
      'EMAIL;TYPE=INTERNET:EMAIL@信息.缺失',
      'GENDER:M', 'ORG:曲靖一中卓立学校',
      'TITLE:副校长,八级管理',
      'END:VCARD'
    ].join(CRLF)
  }
]

const qr = (text) =>
  renderToStaticMarkup(
    createElement(QRCodeSVG, {
      value: text,
      level: 'L',
      size: 340,
      bgColor: '#ffffff',
      fgColor: '#000000'
    })
  )

const cards = persons
  .map(
    (p) => `
  <div style="border:1px solid #ccc;border-radius:8px;padding:16px;margin:12px auto;text-align:center;max-width:640px;background:#fff">
    <h3 style="margin:0 0 8px">${p.name}(修复后:占位邮箱 + TITLE 逗号不转义)</h3>
    <div style="display:inline-block;background:#fff;padding:12px;border-radius:8px">${qr(p.vcard)}</div>
    <pre style="text-align:left;font-size:10px;margin:8px auto 0;overflow:auto;max-width:560px">${p.vcard}</pre>
  </div>`
  )
  .join('\n')

const html = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>tans-PIM 修复后复测(占位邮箱+逗号)</title>
<style>body{font-family:sans-serif;background:#eee}</style>
</head>
<body>${cards}</body>
</html>`

writeFileSync(new URL('./qr-test.html', import.meta.url), html)
console.log('已生成 dev_tools/qr-test.html')
