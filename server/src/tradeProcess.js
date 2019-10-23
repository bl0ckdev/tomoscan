const dbDex = require('./models/dex')
const Web3Util = require('./helpers/web3')
const BigNumber = require('bignumber.js')
const logger = require('./helpers/logger')
const TomoToken = '0x0000000000000000000000000000000000000001'

const decimalFunction = '0x313ce567'

async function getSaveTime (date) {
    let min = date.getMinutes()
    let newMin
    if (min < 15) {
        newMin = 15
    } else if (min < 30) {
        newMin = 30
    } else if (min < 45) {
        newMin = 45
    } else {
        newMin = 0
    }
    let newTime = date
    if (newMin === 0) {
        newTime.setMinutes(0)
        newTime.setHours(newTime.getHours() + 1)
        newTime.setSeconds(0)
        newTime.setMilliseconds(0)
    } else {
        newTime.setMinutes(newMin)
        newTime.setSeconds(0)
        newTime.setMilliseconds(0)
    }
    return newTime
}

function getNumberOfWeek (date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
}

async function run () {
    let web3 = await Web3Util.getWeb3()
    dbDex.Trade.watch().on('change', async (data) => {
        logger.info('new trade %s', data.fullDocument.hash)
        let makerExchange = data.fullDocument.makerExchange
        let takerExchange = data.fullDocument.takerExchange
        let pairName = data.fullDocument.pairName
        let baseToken = data.fullDocument.baseToken
        let quoteToken = data.fullDocument.quoteToken
        let amount = data.fullDocument.amount
        let makeFee = data.fullDocument.makeFee
        let takeFee = data.fullDocument.takeFee
        let price = data.fullDocument.pricepoint

        let quoteDecimal
        if (quoteToken === TomoToken) {
            quoteDecimal = 18
        } else {
            let token = await dbDex.Token.findOne({ contractAddress: quoteToken })
            if (token) {
                quoteDecimal = token.decimals
            } else {
                let decimals = await web3.eth.call({ to: quoteToken, data: decimalFunction })
                quoteDecimal = await web3.utils.hexToNumber(decimals)
            }
        }
        let baseDecimal
        if (baseToken === TomoToken) {
            baseDecimal = 18
        } else {
            let token = await dbDex.Token.findOne({ contractAddress: baseToken })
            if (token) {
                baseDecimal = token.decimals
            } else {
                let decimals = await web3.eth.call({ to: baseToken, data: decimalFunction })
                baseDecimal = await web3.utils.hexToNumber(decimals)
            }
        }

        price = new BigNumber(price)
        price = price.dividedBy(10 ** quoteDecimal).toNumber()

        amount = new BigNumber(amount)
        amount = amount.dividedBy(10 ** baseDecimal)

        makeFee = new BigNumber(makeFee)
        makeFee = makeFee.dividedBy(10 ** quoteDecimal)

        takeFee = new BigNumber(takeFee)
        takeFee = takeFee.dividedBy(10 ** quoteDecimal)

        let volume = amount.multipliedBy(price).toNumber()

        let currentTime = new Date()

        if (makerExchange === takerExchange) {
            await dbDex.HistoryStatistic.updateOne({
                exchangeAddress: makerExchange,
                baseToken: baseToken,
                quoteToken: quoteToken,
                pairName: pairName,
                date: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())
            },
            { $inc: {
                volume24h: volume,
                tradeNumber: 1,
                totalFee: makeFee.plus(takeFee).toNumber()
            } }, { upsert: true, new: true })

            await dbDex.Statistic.updateOne({
                exchangeAddress: makerExchange,
                baseToken: baseToken,
                quoteToken: quoteToken,
                pairName: pairName,
                date: await getSaveTime(currentTime)
            },
            { $inc: {
                volume: volume,
                tradeNumber: 1,
                totalFee: makeFee.plus(takeFee).toNumber()
            } }, { upsert: true, new: true })

            await dbDex.WeeklyStatistic.updateOne({
                exchangeAddress: makerExchange,
                baseToken: baseToken,
                quoteToken: quoteToken,
                pairName: pairName,
                year: (new Date()).getFullYear(),
                week: getNumberOfWeek(new Date())
            },
            { $inc: {
                volume: volume,
                tradeNumber: 1,
                totalFee: makeFee.plus(takeFee).toNumber()
            } }, { upsert: true, new: true })

            await dbDex.MonthlyStatistic.updateOne({
                exchangeAddress: makerExchange,
                baseToken: baseToken,
                quoteToken: quoteToken,
                pairName: pairName,
                year: (new Date()).getFullYear(),
                month: (new Date()).getMonth()
            },
            { $inc: {
                volume: volume,
                tradeNumber: 1,
                totalFee: makeFee.plus(takeFee).toNumber()
            } }, { upsert: true, new: true })
        } else {
            await dbDex.HistoryStatistic.updateOne({
                exchangeAddress: makerExchange,
                baseToken: baseToken,
                quoteToken: quoteToken,
                pairName: pairName,
                date: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())
            },
            {
                $inc: {
                    volume24h: volume,
                    tradeNumber: 1,
                    totalFee: makeFee.toNumber()
                }
            }, { upsert: true, new: true })

            await dbDex.Statistic.updateOne({
                exchangeAddress: makerExchange,
                baseToken: baseToken,
                quoteToken: quoteToken,
                pairName: pairName,
                date: await getSaveTime(currentTime)
            },
            { $inc: {
                volume: volume,
                tradeNumber: 1,
                totalFee: makeFee.toNumber()
            } }, { upsert: true, new: true })

            await dbDex.HistoryStatistic.updateOne({
                exchangeAddress: takerExchange,
                baseToken: baseToken,
                quoteToken: quoteToken,
                pairName: pairName,
                date: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())
            },
            {
                $inc: {
                    volume24h: volume,
                    tradeNumber: 1,
                    totalFee: takeFee.toNumber()
                }
            }, { upsert: true, new: true })

            await dbDex.Statistic.updateOne({
                exchangeAddress: takerExchange,
                baseToken: baseToken,
                quoteToken: quoteToken,
                pairName: pairName,
                date: await getSaveTime(currentTime)
            },
            { $inc: {
                volume: volume,
                tradeNumber: 1,
                totalFee: takeFee.toNumber()
            } }, { upsert: true, new: true })

            await dbDex.WeeklyStatistic.updateOne({
                exchangeAddress: makerExchange,
                baseToken: baseToken,
                quoteToken: quoteToken,
                pairName: pairName,
                year: (new Date()).getFullYear(),
                week: getNumberOfWeek(new Date())
            },
            { $inc: {
                volume: volume,
                tradeNumber: 1,
                totalFee: makeFee.toNumber()
            } }, { upsert: true, new: true })

            await dbDex.MonthlyStatistic.updateOne({
                exchangeAddress: makerExchange,
                baseToken: baseToken,
                quoteToken: quoteToken,
                pairName: pairName,
                year: (new Date()).getFullYear(),
                month: (new Date()).getMonth()
            },
            { $inc: {
                volume: volume,
                tradeNumber: 1,
                totalFee: makeFee.toNumber()
            } }, { upsert: true, new: true })

            await dbDex.WeeklyStatistic.updateOne({
                exchangeAddress: takerExchange,
                baseToken: baseToken,
                quoteToken: quoteToken,
                pairName: pairName,
                year: (new Date()).getFullYear(),
                week: getNumberOfWeek(new Date())
            },
            { $inc: {
                volume: volume,
                tradeNumber: 1,
                totalFee: takeFee.toNumber()
            } }, { upsert: true, new: true })

            await dbDex.MonthlyStatistic.updateOne({
                exchangeAddress: takerExchange,
                baseToken: baseToken,
                quoteToken: quoteToken,
                pairName: pairName,
                year: (new Date()).getFullYear(),
                month: (new Date()).getMonth()
            },
            { $inc: {
                volume: volume,
                tradeNumber: 1,
                totalFee: takeFee.toNumber()
            } }, { upsert: true, new: true })
        }
    })
}

run()