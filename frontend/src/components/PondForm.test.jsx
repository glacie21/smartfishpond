import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PondForm } from './PondForm.jsx';

vi.mock('../api/client.js', () => ({
  api: { createPond: vi.fn(), updatePond: vi.fn() },
}));

const { api } = await import('../api/client.js');

beforeEach(() => vi.clearAllMocks());

describe('PondForm', () => {
  it('membuat kolam baru; field kosong tidak dikirim, kedalaman jadi angka', async () => {
    const onDone = vi.fn();
    api.createPond.mockResolvedValue({ id: 'pond-03' });
    render(<PondForm onDone={onDone} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/ID kolam/), 'pond-03');
    await userEvent.type(screen.getByLabelText('Nama'), ' Kolam C ');
    await userEvent.type(screen.getByLabelText('Kedalaman (cm)'), '120');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));

    expect(api.createPond).toHaveBeenCalledWith({ id: 'pond-03', name: 'Kolam C', depthCm: 120 });
    expect(onDone).toHaveBeenCalledWith({ id: 'pond-03' });
  });

  it('mode ubah tidak menampilkan ID dan memakai nilai lama', async () => {
    api.updatePond.mockResolvedValue({ id: 'pond-01', name: 'Kolam Utama' });
    render(<PondForm pond={{ id: 'pond-01', name: 'pond-01' }} onDone={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByLabelText(/ID kolam/)).not.toBeInTheDocument();
    const name = screen.getByLabelText('Nama');
    await userEvent.clear(name);
    await userEvent.type(name, 'Kolam Utama');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));

    expect(api.updatePond).toHaveBeenCalledWith('pond-01', { name: 'Kolam Utama' });
  });

  it('menampilkan error dari server', async () => {
    api.createPond.mockRejectedValue(new Error('Kolam "pond-01" sudah terdaftar'));
    render(<PondForm onDone={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/ID kolam/), 'pond-01');
    await userEvent.type(screen.getByLabelText('Nama'), 'A');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));

    expect(await screen.findByText('Kolam "pond-01" sudah terdaftar')).toBeInTheDocument();
  });
});
