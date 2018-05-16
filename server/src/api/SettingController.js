import { Router } from 'express'
import Block from '../models/Block'
import Account from '../models/Account'
import Token from '../models/Token'
import axios from 'axios'

const SettingController = Router()

SettingController.get('/setting', async (req, res, next) => {
  try {
    // Get total blocks in db.
    let totalBlock = await Block.find().count()
    let totalAddress = await Account.find().count()
    let totalToken = await Token.find().count()
    let totalSmartContract = await Account.find({isContract: true}).count()
    let lastBlock = await Block.findOne().sort({number: -1})

    return res.json(
      {
        lastBlock,
        stats: {totalBlock, totalAddress, totalToken, totalSmartContract},
      })
  }
  catch (e) {
    console.log(e)
    throw e
  }
})

SettingController.get('/setting/usd', async (req, res, next) => {
  try {
    let {data} = await axios.get('https://api.coinmarketcap.com/v2/ticker/' +
      process.env.CMC_ID + '/?convert=USD')

    return res.json(data)
  }
  catch (e) {
    console.log(e)
    throw e
  }
})

export default SettingController