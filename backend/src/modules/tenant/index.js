const express = require("express");
const { si } = require('../../middleware/sanitize');
const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const tenants = await req.prisma.tenant.findMany();
    res.json(tenants);
  } catch (error) {
    console.error("Error fetching tenants:", error);
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const tenant = await req.prisma.tenant.findUnique({
      where: { id: req.params.id },
    });
    res.json(tenant);
  } catch (error) {
    console.error("Error fetching tenant:", error);
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    console.log("Creating tenant with data:", req.body);
    const tenant = await req.prisma.tenant.create({
      data: req.body,
    });
    res.status(201).json(tenant);
  } catch (error) {
    console.error("Error creating tenant:", error);
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const tenant = await req.prisma.tenant.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(tenant);
  } catch (error) {
    console.error("Error updating tenant:", error);
    next(error);
  }
});

router.get("/:id/contacts", async (req, res, next) => {
  try {
    const contacts = await req.prisma.tenantAdminContact.findMany({
      where: { tenantId: req.params.id },
    });
    res.json(contacts);
  } catch (error) {
    console.error("Error fetching contacts:", error);
    next(error);
  }
});

module.exports = router;