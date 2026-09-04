import * as deviceService from '../services/deviceService.js';

export async function list(req, res) {
  const devices = await deviceService.listDevices({ pondId: req.query.pondId });
  res.json({ data: devices });
}

export async function detail(req, res) {
  res.json({ data: await deviceService.getDeviceWithLatest(req.params.id) });
}
