const mongoose = require('mongoose');

const quotationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    supplier: {
        type: String,
        required: true
    },
    list_price: {
        type: Number
    },
    quote_unit_price: {
        type: Number,
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    discount_rate: {
        type: Number
    },
    quote_total_price: {
        type: Number,
        required: true
    },
    quote_validity: {
        type: Date,
        required: true
    },
    notes: String,
    created_at: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Quotation', quotationSchema); 