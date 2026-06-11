const express = require('express');
const runMatch = require('../services/matcher');

const router = express.Router();

router.get('/:poNumber', async (req, res) => {
  const result = await runMatch(req.params.poNumber);
  res.json(result);
});

module.exports = router;
