const fs = require("fs");
const path = require("path");
const axios = require("axios");

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_PATH = path.join(DATA_DIR, "harga.json");
const CSV_PATH = path.join(DATA_DIR, "riwayat.csv");
const README_PATH = path.join(__dirname, "..", "README.md");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function formatRupiah(angka) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(angka);
}

function updateRiwayatCSV(harga, waktu, kurs) {
  const row = [
    waktu,
    harga.bitcoin,
    harga.ethereum,
    harga.solana,
    harga.usdt,
    kurs,
  ].join(",");

  if (!fs.existsSync(CSV_PATH)) {
    fs.writeFileSync(
      CSV_PATH,
      "timestamp,bitcoin,ethereum,solana,usdt,usd_idr\n"
    );
  }

  const existing = fs.readFileSync(CSV_PATH, "utf-8").trim().split("\n");
  const lastTimestamp =
    existing.length > 1 ? existing[existing.length - 1].split(",")[0] : null;

  if (lastTimestamp !== waktu) {
    fs.appendFileSync(CSV_PATH, row + "\n");
    console.log("📊 Riwayat harga diperbarui.");
  }
}

function updateReadme(harga, waktu, kurs) {
  const waktuLokal = new Date(waktu).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
  });

  const konten = `
<!-- HARGA_KRIPTO -->
## 📈 Harga Kripto Terbaru

> Data ini diperbarui secara otomatis menggunakan [CoinGecko API](https://www.coingecko.com/) dan [exchangerate.host](https://exchangerate.host/)

<div align="center">

| 🪙 Token | 💰 Harga (IDR) |
|:------:|---------------:|
| 🟠 **Bitcoin (BTC)**   | ${formatRupiah(harga.bitcoin)} |
| 🔵 **Ethereum (ETH)**  | ${formatRupiah(harga.ethereum)} |
| 🟣 **Solana (SOL)**    | ${formatRupiah(harga.solana)} |
| 🟢 **Tether (USDT)**   | ${formatRupiah(harga.usdt)} |

---

💱 **Kurs Rupiah (USD → IDR)**: ${formatRupiah(kurs)}

🕒 <sub>Terakhir diperbarui: ${waktuLokal}</sub>

</div>
<!-- /HARGA_KRIPTO -->
`.trim();

  let readme = fs.readFileSync(README_PATH, "utf-8");
  const regex = /<!-- HARGA_KRIPTO -->([\s\S]*?)<!-- \/HARGA_KRIPTO -->/;

  if (regex.test(readme)) {
    readme = readme.replace(regex, konten);
  } else {
    readme += "\n\n" + konten;
  }

  fs.writeFileSync(README_PATH, readme);
  console.log("📘 README.md diperbarui.");
}

async function ambilKurs() {
  try {
    const hargaKriptoRes = await axios.get(
      "https://api.coingecko.com/api/v3/simple/price",
      {
        params: {
          ids: "bitcoin,ethereum,solana,tether,usd",
          vs_currencies: "idr",
        },
      }
    );

    const data = hargaKriptoRes.data;
    const kursRupiah = data?.usd?.idr;

    if (
      !data?.bitcoin?.idr ||
      !data?.ethereum?.idr ||
      !data?.solana?.idr ||
      !data?.tether?.idr ||
      !kursRupiah
    ) {
      console.error("Respon API tidak lengkap:", {
        harga: data,
        kurs: kursRupiah,
      });
      throw new Error("Data tidak lengkap dari API.");
    }

    const dataBaru = {
      waktu: new Date().toISOString(),
      harga: {
        bitcoin: data.bitcoin.idr,
        ethereum: data.ethereum.idr,
        solana: data.solana.idr,
        usdt: data.tether.idr,
      },
      kurs: kursRupiah,
    };

    let dataLama = {};
    if (fs.existsSync(DATA_PATH)) {
      try {
        const fileContent = fs.readFileSync(DATA_PATH, "utf-8").trim();
        dataLama = fileContent ? JSON.parse(fileContent) : {};
      } catch {
        console.warn("⚠️ Gagal membaca harga.json, akan ditimpa.");
      }
    }

    const hargaLama = JSON.stringify(dataLama.harga || {});
    const hargaBaru = JSON.stringify(dataBaru.harga);

    if (hargaLama !== hargaBaru || dataLama.kurs !== dataBaru.kurs) {
      fs.writeFileSync(DATA_PATH, JSON.stringify(dataBaru, null, 2));
      updateRiwayatCSV(dataBaru.harga, dataBaru.waktu, dataBaru.kurs);
      updateReadme(dataBaru.harga, dataBaru.waktu, dataBaru.kurs);
      console.log("✅ Harga dan kurs diperbarui.");
    } else {
      console.log("ℹ️ Tidak ada perubahan harga atau kurs.");
    }
  } catch (err) {
    console.error("❌ Gagal mengambil data:", err.message);
    process.exit(1);
  }
}

ambilKurs();
