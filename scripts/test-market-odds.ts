import assert from 'node:assert/strict'
import {
  americanToDecimal,
  decimalToImplied,
  impliedProbabilities,
  parseMarketOdds,
} from '../src/lib/marketOdds.ts'
import * as marketOdds from '../src/lib/marketOdds.ts'
import type { MarketLine, MarketProb } from '../src/lib/marketOdds.ts'

// Fixtures com o formato REAL do summary da ESPN (valores copiados de
// bra.1/summary?event=401841246, coletados com curl --compressed).

// odds[0] / pickcenter[0]: DraftKings, moneyline americano em homeTeamOdds|awayTeamOdds|drawOdds
// e tambem no objeto moneyline { close: { odds: '+300' } }.
const draftKings = {
  provider: { id: '100', name: 'DraftKings', priority: 1 },
  details: 'PAL -110',
  overUnder: 2.5,
  spread: 0.5,
  overOdds: -110.0,
  underOdds: -120.0,
  awayTeamOdds: { favorite: true, underdog: false, moneyLine: -110, spreadOdds: -120.0, teamId: '2029' },
  homeTeamOdds: { favorite: false, underdog: true, moneyLine: 300, spreadOdds: -115.0, teamId: '6273' },
  drawOdds: { moneyLine: 255.0 },
  moneyline: {
    displayName: 'Moneyline',
    shortDisplayName: 'ML',
    home: { close: { odds: '+300' }, open: { odds: '+290' } },
    away: { close: { odds: '-110' }, open: { odds: '-120' } },
    draw: { close: { odds: '+255' }, open: { odds: '+260' } },
  },
  link: { text: 'See More Odds', href: 'https://sportsbook.draftkings.com' },
}

// odds[1]: Bet 365, sem moneyline/overUnder, decimal dentro de teamOdds.odds.value
const bet365 = {
  provider: { id: '2000', name: 'Bet 365', priority: 0 },
  awayTeamOdds: { odds: { summary: '10/1', value: 11.0, handicap: 0.0 } },
  homeTeamOdds: { odds: { summary: '20/1', value: 21.0, handicap: 0.0 } },
  drawOdds: { summary: '1/12', value: 1.083, handicap: 0.0 },
}

// --- 1. odd americana negativa ---

assert.equal(americanToDecimal(-110), 1.9090909090909092)
assert.equal(Math.round(americanToDecimal(-110)! * 1e4) / 1e4, 1.9091)
assert.equal(Math.round(americanToDecimal(-270)! * 1e4) / 1e4, 1.3704)
assert.equal(americanToDecimal(-100), 2)
assert.equal(decimalToImplied(1.9090909090909092), 0.5238)
assert.equal(decimalToImplied(1.9091), 0.5238)

// --- 2. odd americana positiva ---

assert.equal(americanToDecimal(145), 2.45)
assert.equal(americanToDecimal(100), 2)
assert.equal(americanToDecimal(255), 3.55)
assert.equal(decimalToImplied(2.45), 0.4082)

// --- 3. odd decimal ---

assert.equal(decimalToImplied(1.85), 0.5405)
assert.equal(decimalToImplied(2.05), 0.4878)

const decimalThreeWay = parseMarketOdds({
  odds: [{
    provider: { name: 'Casa Decimal' },
    overUnder: 2.5,
    moneyline: {
      home: { odds: '1.85' },
      draw: { odds: '3.40' },
      away: { odds: '2.05' },
    },
  }],
})
assert.equal(decimalThreeWay.length, 1)
assert.deepEqual(decimalThreeWay[0], {
  provider: 'Casa Decimal',
  home: 1.85,
  draw: 3.4,
  away: 2.05,
  over_under: 2.5,
  detail: null,
})
assert.deepEqual(impliedProbabilities(decimalThreeWay[0]), {
  provider: 'Casa Decimal',
  home: 0.4087,
  draw: 0.2224,
  away: 0.3689,
  margin: 0.3225,
  raw: decimalThreeWay[0],
})

// --- 4. com empate (3 vias, fixture real DraftKings) ---

const dkLines = parseMarketOdds({ odds: [draftKings], pickcenter: [draftKings] })
assert.equal(dkLines.length, 1, 'pickcenter duplicando o mesmo provider nao pode virar duas linhas')
assert.deepEqual(dkLines[0], {
  provider: 'DraftKings',
  home: 4,
  draw: 3.55,
  away: 1.9091,
  over_under: 2.5,
  detail: 'PAL -110',
})
const dk = impliedProbabilities(dkLines[0])!
assert.deepEqual(dk, {
  provider: 'DraftKings',
  home: 0.2369,
  draw: 0.2669,
  away: 0.4963,
  margin: 0.0555,
  raw: dkLines[0],
})
assert.equal(dk.draw !== null, true)

// bloco sem mercado declarado (fixture real Bet 365: so homeTeamOdds.odds.value, sem
// `moneyline`) nao publica probabilidade — ver comentario de sideDecimal em marketOdds.ts
assert.deepEqual(parseMarketOdds({ odds: [bet365] }), [])

// os mesmos numeros decimais, agora em mercado declarado, viram probabilidade
const declaredDecimal = parseMarketOdds({
  odds: [{
    provider: { name: 'Bet 365' },
    moneyline: { home: { odds: '21.0' }, draw: { odds: '1.083' }, away: { odds: '11.0' } },
  }],
})
assert.deepEqual(declaredDecimal[0], {
  provider: 'Bet 365',
  home: 21,
  draw: 1.083,
  away: 11,
  over_under: null,
  detail: null,
})
assert.deepEqual(impliedProbabilities(declaredDecimal[0]), {
  provider: 'Bet 365',
  home: 0.0448,
  draw: 0.8695,
  away: 0.0856,
  margin: 0.0619,
  raw: declaredDecimal[0],
})

// decimal tambem chega pelo caminho moneyLine (2.1 = 1.1 de lucro por 1 apostado)
const decimalMoneyLine = parseMarketOdds({
  odds: [{ provider: { name: 'Casa' }, homeTeamOdds: { moneyLine: 2.1 }, awayTeamOdds: { moneyLine: 3.5 } }],
})
assert.deepEqual(decimalMoneyLine[0].home, 2.1)
assert.deepEqual(decimalMoneyLine[0].away, 3.5)

// --- 5. sem empate (2 vias) ---

const twoWay = impliedProbabilities({
  provider: 'Casa 2 vias',
  home: 1.7142857142857142, // -140
  draw: null,
  away: 2.2, // +120
  over_under: null,
  detail: null,
})!
assert.deepEqual(twoWay, {
  provider: 'Casa 2 vias',
  home: 0.562,
  draw: null,
  away: 0.438,
  margin: 0.0379,
  raw: { provider: 'Casa 2 vias', home: 1.7142857142857142, draw: null, away: 2.2, over_under: null, detail: null },
})
assert.equal(twoWay.draw, null, 'sem draw a normalizacao usa so os dois lados')
assert.equal(twoWay.home + twoWay.away, 1)

// sem away nao ha o que normalizar: null (nunca 0)
assert.equal(impliedProbabilities({ provider: 'X', home: 2, draw: null, away: null, over_under: null, detail: null }), null)
assert.equal(impliedProbabilities({ provider: 'X', home: null, draw: null, away: 2, over_under: null, detail: null }), null)

// --- 6. margem removida ---

const evenPair = impliedProbabilities({ provider: 'Par', home: 1.9091, draw: null, away: 1.9091, over_under: null, detail: null })!
assert.equal(evenPair.margin, 0.0476, 'margem = soma bruta - 1 (juice de -110/-110 = 4.76%)')
assert.equal(evenPair.home, 0.5)
assert.equal(evenPair.away, 0.5)
// margem e sempre round4(soma bruta das implicitas - 1), reconstruida a partir das odds da linha
const somaBruta = 1 / evenPair.raw.home! + 1 / evenPair.raw.away!
assert.equal(evenPair.margin, Math.round((somaBruta - 1) * 1e4) / 1e4)

for (const prob of [dk, twoWay, evenPair]) {
  const soma = prob.home + prob.away + (prob.draw ?? 0)
  assert.ok(Math.abs(soma - 1) < 0.0002, `probabilidades normalizadas devem somar 1 (recebido ${soma})`)
  assert.ok(prob.margin > 0, 'margem de casa publicada e positiva')
}

// --- 7. secao vazia ---

assert.deepEqual(parseMarketOdds({ odds: [], pickcenter: [] }), [])
assert.deepEqual(parseMarketOdds({ odds: [], pickcenter: [], header: { league: { name: 'Brazilian Serie A' } } }), [])
// entrada sem nenhuma odd nao publica linha fantasma
assert.deepEqual(parseMarketOdds({ odds: [{ provider: { name: 'Sem odds' }, details: 'X' }] }), [])
// secao com tipo errado tambem e ausencia
assert.deepEqual(parseMarketOdds({ odds: 'n/a', pickcenter: 42 }), [])

// --- 8. payload nulo ---

assert.deepEqual(parseMarketOdds(null), [])
assert.deepEqual(parseMarketOdds(undefined), [])
assert.deepEqual(parseMarketOdds('texto'), [])
assert.deepEqual(parseMarketOdds(42), [])
assert.deepEqual(parseMarketOdds([]), [])
assert.deepEqual(parseMarketOdds({}), [])

// --- 9. odds ausente mas pickcenter presente ---

const fromPickcenter = parseMarketOdds({
  pickcenter: [{
    provider: { id: '300', name: 'Caesars' },
    details: 'FLA -105',
    overUnder: 2.5,
    moneyline: {
      home: { odds: '-105', value: 1.9523809523809523, link: { href: 'https://example/caesars', text: 'Home Bet' } },
      draw: { odds: '+240', value: 3.4, link: { href: 'https://example/caesars', text: 'Draw Bet' } },
      away: { odds: '+260', value: 3.6, link: { href: 'https://example/caesars', text: 'Away Bet' } },
    },
  }],
})
assert.equal(fromPickcenter.length, 1)
assert.deepEqual(fromPickcenter[0], {
  provider: 'Caesars',
  home: 1.9524,
  draw: 3.4,
  away: 3.6,
  over_under: 2.5,
  detail: 'FLA -105',
})
const caesars = impliedProbabilities(fromPickcenter[0])!
assert.deepEqual(
  { home: caesars.home, draw: caesars.draw, away: caesars.away, margin: caesars.margin },
  { home: 0.4725, draw: 0.2713, away: 0.2562, margin: 0.0841 }
)

// odds vazio + pickcenter preenchido: cai para o pickcenter
const emptyOdds = parseMarketOdds({ odds: [], pickcenter: [draftKings] })
assert.equal(emptyOdds.length, 1)
assert.equal(emptyOdds[0].provider, 'DraftKings')

// odds presente: providers extras do pickcenter entram, duplicados nao
const merged = parseMarketOdds({
  odds: [draftKings],
  pickcenter: [draftKings, { provider: { name: 'Bet 365' }, homeTeamOdds: { moneyLine: 250 }, awayTeamOdds: { moneyLine: -200 } }],
})
assert.deepEqual(merged.map((line) => line.provider), ['DraftKings', 'Bet 365'])

// fractional ("10/1") tambem e detectado pelo separador
const fractional = parseMarketOdds({
  odds: [{ provider: { name: 'Bet 365' }, moneyline: { home: { odds: '10/1' } } }],
})
assert.equal(fractional[0].home, 11)

// --- contrato congelado: nada a mais, nada a menos ---

assert.deepEqual(
  Object.keys(marketOdds).sort(),
  ['americanToDecimal', 'decimalToImplied', 'impliedProbabilities', 'parseMarketOdds'],
  'superficie exportada tem que ser exatamente o contrato'
)
assert.deepEqual(
  Object.keys(dkLines[0]).sort(),
  ['away', 'detail', 'draw', 'home', 'over_under', 'provider'].sort()
)
const probKeys: (keyof MarketProb)[] = ['provider', 'home', 'draw', 'away', 'margin', 'raw']
assert.deepEqual(Object.keys(dk).sort(), [...probKeys].sort())
const lineTypes: MarketLine = dkLines[0]
assert.equal(lineTypes.over_under, 2.5)

// invalidos: nunca viram 0
assert.equal(americanToDecimal(null), null)
assert.equal(americanToDecimal(0), null)
assert.equal(americanToDecimal(Number.NaN), null)
assert.equal(americanToDecimal(-50), null, 'escala americana nao existe entre -100 e +100')
assert.equal(americanToDecimal(2.5), null, '2.5 e decimal, nao americana')
assert.equal(decimalToImplied(null), null)
assert.equal(decimalToImplied(0), null)
assert.equal(decimalToImplied(1), null)
assert.equal(decimalToImplied(0.5), null)

console.log('market odds tests ok')
