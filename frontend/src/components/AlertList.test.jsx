import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AlertList } from './AlertList.jsx';

const baseAlert = {
  id: 1,
  type: 'metric',
  metric: 'dissolved_oxygen',
  severity: 'critical',
  message: 'Oksigen terlarut 3.2 mg/L di bawah batas aman 5 mg/L',
  pond_id: 'pond-01',
  pond_name: 'Kolam A',
  device_id: 'esp32-node-01',
  device_name: 'Node A',
  started_at: new Date(Date.now() - 15 * 60_000).toISOString(),
  resolved_at: null,
  acknowledged_at: null,
  acknowledged_by: null,
};

const renderList = (props) =>
  render(
    <MemoryRouter>
      <AlertList onAcknowledge={vi.fn()} {...props} />
    </MemoryRouter>,
  );

describe('AlertList', () => {
  it('menampilkan pesan kosong bila tidak ada alert', () => {
    renderList({ alerts: [], emptyText: 'Semua aman' });
    expect(screen.getByText('Semua aman')).toBeInTheDocument();
  });

  it('menampilkan label metrik, pesan, kolam, dan durasi', () => {
    renderList({ alerts: [baseAlert] });

    expect(screen.getByText('Oksigen Terlarut')).toBeInTheDocument();
    expect(screen.getByText(baseAlert.message)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kolam A' })).toHaveAttribute('href', '/ponds/pond-01');
    expect(screen.getByText(/sudah 15 mnt/)).toBeInTheDocument();
    expect(screen.getByText('Kritis')).toBeInTheDocument();
  });

  it('alert device offline diberi judul "Perangkat offline"', () => {
    renderList({ alerts: [{ ...baseAlert, type: 'device_offline', metric: null }] });
    expect(screen.getByText('Perangkat offline')).toBeInTheDocument();
  });

  it('tombol "Tandai ditangani" memanggil handler dengan id alert', async () => {
    const onAcknowledge = vi.fn(async () => ({}));
    renderList({ alerts: [baseAlert], onAcknowledge });

    await userEvent.click(screen.getByRole('button', { name: 'Tandai ditangani' }));
    expect(onAcknowledge).toHaveBeenCalledWith(1);
  });

  it('menampilkan error bila penandaan gagal', async () => {
    const onAcknowledge = vi.fn(async () => {
      throw new Error('Alert #1 sudah ditandai oleh ani');
    });
    renderList({ alerts: [baseAlert], onAcknowledge });

    await userEvent.click(screen.getByRole('button', { name: 'Tandai ditangani' }));
    expect(await screen.findByText('Alert #1 sudah ditandai oleh ani')).toBeInTheDocument();
  });

  it('alert yang sudah ditandai menampilkan siapa yang menangani', () => {
    renderList({ alerts: [{ ...baseAlert, acknowledged_at: new Date().toISOString(), acknowledged_by: 'budi' }] });
    expect(screen.getByText('✓ Ditangani budi')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tandai ditangani' })).not.toBeInTheDocument();
  });

  it('alert pulih tidak bisa ditandai dan diberi label Pulih', () => {
    renderList({ alerts: [{ ...baseAlert, resolved_at: new Date().toISOString() }] });
    expect(screen.getByText('Pulih')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('di halaman kolam, nama kolam tidak diulang', () => {
    renderList({ alerts: [baseAlert], showPond: false });
    expect(screen.queryByRole('link', { name: 'Kolam A' })).not.toBeInTheDocument();
  });
});
