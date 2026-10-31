/**
 * Membuat akun dashboard, atau mengganti password/peran akun yang sudah ada.
 *
 * Pemakaian:
 *   npm run user:create -- <username> [--role admin|viewer]
 *   docker compose exec backend node src/cli/createUser.js <username> --role admin
 *
 * Password ditanyakan secara interaktif (tidak tampil di layar). Untuk
 * otomasi, isi env NEW_USER_PASSWORD — jangan lewat argumen CLI karena
 * akan tersimpan di riwayat shell.
 */
import { createInterface } from 'node:readline';

import { closePool } from '../db/pool.js';
import { createOrUpdateUser, ROLES } from '../services/authService.js';

const MIN_PASSWORD_LENGTH = 8;

function parseArgs(argv) {
  const args = argv.slice(2);
  const roleIndex = args.indexOf('--role');
  const role = roleIndex === -1 ? 'viewer' : args[roleIndex + 1];
  // Nilai setelah --role bukan username.
  const roleValueIndex = roleIndex === -1 ? -1 : roleIndex + 1;
  const username = args.find((arg, i) => !arg.startsWith('--') && i !== roleValueIndex);
  return { username, role };
}

/** Membaca satu baris dari terminal tanpa menampilkan ketikan. */
function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    // Tampilkan pertanyaannya saja, sembunyikan apa yang diketik.
    rl._writeToOutput = (text) => {
      if (text.startsWith(question)) process.stdout.write(question);
    };
  });
}

async function readPassword() {
  if (process.env.NEW_USER_PASSWORD) return process.env.NEW_USER_PASSWORD;
  if (!process.stdin.isTTY) {
    throw new Error('Terminal tidak interaktif: isi password lewat env NEW_USER_PASSWORD');
  }
  const password = await promptHidden('Password: ');
  const confirmation = await promptHidden('Ulangi password: ');
  if (password !== confirmation) throw new Error('Password tidak sama');
  return password;
}

async function main() {
  const { username, role } = parseArgs(process.argv);

  if (!username || !/^[a-zA-Z0-9_.-]{3,64}$/.test(username)) {
    throw new Error(
      'Username wajib diisi: 3–64 karakter huruf, angka, titik, - atau _\n' +
        'Contoh: npm run user:create -- admin --role admin',
    );
  }
  if (!ROLES.includes(role)) {
    throw new Error(`Peran harus salah satu dari: ${ROLES.join(', ')}`);
  }

  const password = await readPassword();
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password minimal ${MIN_PASSWORD_LENGTH} karakter`);
  }

  const user = await createOrUpdateUser({ username, password, role });
  console.log(`User "${user.username}" (${user.role}) tersimpan.`);
}

main()
  .catch((err) => {
    console.error(`Gagal: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(closePool);
