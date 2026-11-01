import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActuatorPanel } from './ActuatorPanel.jsx';

vi.mock('../api/client.js', () => ({
  api: { sendCommand: vi.fn() },
}));

const { api } = await import('../api/client.js');

const onlineDevice = {
  id: 'esp32-node-01',
  name: 'Node A',
  status: 'online',
  actuators: { aerator: true, pump: false },
};

/** Baris aktuator (label -> elemen) untuk query di dalamnya. */
const row = (label) => screen.getByText(label).closest('.actuator');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ActuatorPanel', () => {
  it('menampilkan status relay yang dilaporkan device', () => {
    render(<ActuatorPanel device={onlineDevice} canControl={false} commands={{}} />);

    expect(row('Aerator')).toHaveTextContent('MENYALA');
    expect(row('Pompa air')).toHaveTextContent('MATI');
    // Feeder belum pernah dilaporkan device.
    expect(row('Pemberi pakan')).toHaveTextContent('Tidak diketahui');
  });

  it('viewer tidak melihat tombol kendali', () => {
    render(<ActuatorPanel device={onlineDevice} canControl={false} commands={{}} />);
    expect(screen.queryByRole('button', { name: 'Nyalakan' })).not.toBeInTheDocument();
  });

  it('admin menyalakan feeder dengan durasi bawaan 10 detik', async () => {
    api.sendCommand.mockResolvedValue({ id: 'cmd-1', status: 'sent' });
    render(<ActuatorPanel device={onlineDevice} canControl commands={{}} />);

    const feeder = row('Pemberi pakan');
    await userEvent.click(feeder.querySelector('button.btn:not(.btn--quiet)'));

    expect(api.sendCommand).toHaveBeenCalledWith('esp32-node-01', {
      actuator: 'feeder',
      state: true,
      durationS: 10,
    });
    expect(feeder).toHaveTextContent('Menunggu konfirmasi perangkat');
  });

  it('mematikan tidak menyertakan durasi', async () => {
    api.sendCommand.mockResolvedValue({ id: 'cmd-2', status: 'sent' });
    render(<ActuatorPanel device={onlineDevice} canControl commands={{}} />);

    const aerator = row('Aerator');
    await userEvent.click(aerator.querySelector('button.btn--quiet'));

    expect(api.sendCommand).toHaveBeenCalledWith('esp32-node-01', { actuator: 'aerator', state: false });
  });

  it('status realtime dari server menggantikan "menunggu"', async () => {
    api.sendCommand.mockResolvedValue({ id: 'cmd-3', status: 'sent' });
    const { rerender } = render(<ActuatorPanel device={onlineDevice} canControl commands={{}} />);

    await userEvent.click(row('Pompa air').querySelector('button.btn:not(.btn--quiet)'));
    rerender(
      <ActuatorPanel
        device={onlineDevice}
        canControl
        commands={{ 'cmd-3': { id: 'cmd-3', status: 'failed', error: 'aktuator tidak terpasang' } }}
      />,
    );

    expect(row('Pompa air')).toHaveTextContent('Perangkat menolak perintah: aktuator tidak terpasang');
  });

  it('menampilkan error dari server, mis. device offline', async () => {
    api.sendCommand.mockRejectedValue(new Error('Perangkat "esp32-node-01" sedang offline'));
    render(<ActuatorPanel device={onlineDevice} canControl commands={{}} />);

    await userEvent.click(row('Aerator').querySelector('button.btn:not(.btn--quiet)'));
    expect(row('Aerator')).toHaveTextContent('sedang offline');
  });

  it('kendali dinonaktifkan saat device offline', () => {
    render(<ActuatorPanel device={{ ...onlineDevice, status: 'offline' }} canControl commands={{}} />);

    expect(screen.getByText(/kendali tidak tersedia/)).toBeInTheDocument();
    for (const button of screen.getAllByRole('button', { name: 'Nyalakan' })) {
      expect(button).toBeDisabled();
    }
  });
});
