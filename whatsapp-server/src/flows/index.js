// const welcomeFlow = require('./welcome.flow');
const orderFlow = require('./order.flow');
const confirmFlow = require('./confirm.flow');
const scheduleFlow = require('./schedule.flow');
const addressFlow = require('./address.flow');
const paymentFlow = require('./payment.flow');
const finalConfirmFlow = require('./final_confirm.flow');
const closeFlow = require('./close.flow');
const stockFlow = require('./stock.flow');

module.exports = {
    // welcome: welcomeFlow,
    order: orderFlow,
    confirm: confirmFlow,
    schedule: scheduleFlow,
    address: addressFlow,
    payment: paymentFlow,
    final_confirm: finalConfirmFlow,
    close: closeFlow,
    stock: stockFlow
};

