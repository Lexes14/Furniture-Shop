const { Op } = require('sequelize');
const { Reservation, Item, User, Category } = require('../models');
const { normalizeSearch, paginate } = require('../utils/helpers');
const { sendStatusEmail } = require('../utils/email');
const { buildReservationReceiptPdf, ensureNotificationDirectory } = require('../utils/notificationFiles');
const path = require('path');

function generateReservationNumber() {
  return `RSV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

async function listReservations(req, res) {
  try {
    const { page, limit, offset } = paginate(req.query);
    const search = normalizeSearch(req.query.search);
    const { status, date } = req.query;

    const where = {};

    if (search) {
      where[Op.or] = [
        { reservationNumber: { [Op.like]: `%${search}%` } },
        { notes: { [Op.like]: `%${search}%` } },
        { '$user.name$': { [Op.like]: `%${search}%` } },
        { '$user.email$': { [Op.like]: `%${search}%` } },
        { '$item.name$': { [Op.like]: `%${search}%` } },
        { '$item.sku$': { [Op.like]: `%${search}%` } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (date) {
      where.reservationDate = date;
    }

    if (req.user?.role !== 'admin') {
      where.userId = req.user?.id;
    }

    const { rows, count } = await Reservation.findAndCountAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email', 'role'] },
        { model: Item, as: 'item', required: false, include: [{ model: Category, as: 'category', required: false }] },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      subQuery: false,
    });

    return res.status(200).json({
      success: true,
      data: rows,
      meta: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch reservations', error: error.message });
  }
}

async function getReservation(req, res) {
  try {
    const reservation = await Reservation.findByPk(req.params.id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email', 'role'] },
        { model: Item, as: 'item', required: false, include: [{ model: Category, as: 'category', required: false }] },
      ],
    });

    if (!reservation) {
      return res.status(404).json({ success: false, message: 'Reservation not found' });
    }

    if (req.user?.role !== 'admin' && reservation.userId !== req.user?.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    return res.status(200).json({ success: true, data: reservation });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch reservation', error: error.message });
  }
}

async function createReservation(req, res) {
  try {
    const { itemId, reservationDate, reservationTime, notes } = req.body;

    if (itemId) {
      const item = await Item.findByPk(itemId);
      if (!item) {
        return res.status(400).json({ success: false, message: 'Item not found' });
      }
    }

    const reservation = await Reservation.create({
      reservationNumber: generateReservationNumber(),
      userId: req.user.id,
      itemId: itemId || null,
      reservationDate,
      reservationTime,
      notes: notes || null,
      status: 'pending',
    });

    return res.status(201).json({ success: true, message: 'Reservation created successfully', data: reservation });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to create reservation', error: error.message });
  }
}

async function updateReservation(req, res) {
  try {
    const reservation = await Reservation.findByPk(req.params.id);
    if (!reservation) {
      return res.status(404).json({ success: false, message: 'Reservation not found' });
    }

    if (req.user?.role !== 'admin' && reservation.userId !== req.user?.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { itemId, reservationDate, reservationTime, status, notes } = req.body;
    const originalStatus = reservation.status;

    if (itemId !== undefined) {
      if (itemId) {
        const item = await Item.findByPk(itemId);
        if (!item) {
          return res.status(400).json({ success: false, message: 'Item not found' });
        }
      }
      reservation.itemId = itemId || null;
    }

    if (reservationDate !== undefined) reservation.reservationDate = reservationDate;
    if (reservationTime !== undefined) reservation.reservationTime = reservationTime;
    if (notes !== undefined) reservation.notes = notes;
    if (req.user?.role === 'admin' && status !== undefined) reservation.status = status;

    await reservation.save();

    if (status && status !== originalStatus && ['approved', 'cancelled'].includes(status)) {
      const refreshedReservation = await Reservation.findByPk(reservation.id, {
        include: [
          { model: User, as: 'user', attributes: ['id', 'name', 'email', 'role'] },
          { model: Item, as: 'item', required: false, include: [{ model: Category, as: 'category', required: false }] },
        ],
      });

      if (refreshedReservation?.user?.email) {
        const receiptsDir = path.join(__dirname, '..', 'uploads', 'receipts');
        await ensureNotificationDirectory(receiptsDir);
        const receiptPath = await buildReservationReceiptPdf(refreshedReservation, receiptsDir);
        await sendStatusEmail({
          to: refreshedReservation.user.email,
          title: `Reservation ${status}`,
          message: `Your reservation ${refreshedReservation.reservationNumber} has been ${status}. The receipt is attached.`,
          attachments: [{ filename: `reservation-${refreshedReservation.reservationNumber}.pdf`, path: receiptPath }],
        });
      }
    }

    return res.status(200).json({ success: true, message: 'Reservation updated successfully', data: reservation });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update reservation', error: error.message });
  }
}

async function deleteReservation(req, res) {
  try {
    const reservation = await Reservation.findByPk(req.params.id);
    if (!reservation) {
      return res.status(404).json({ success: false, message: 'Reservation not found' });
    }

    if (req.user?.role !== 'admin' && reservation.userId !== req.user?.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await reservation.destroy();

    return res.status(200).json({ success: true, message: 'Reservation deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete reservation', error: error.message });
  }
}

module.exports = {
  listReservations,
  getReservation,
  createReservation,
  updateReservation,
  deleteReservation,
};
