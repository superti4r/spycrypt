const fs = require("fs");
const path = require("path");
const axios = require("axios");

const DATA_PATH = path.join(__dirname, "..", "data", "harga.json");
const CSV_PATH = path.join(__dirname, "..", "data", "riwayat.csv");
const README_PATH = path.join(__dirname, "..", "README.md");

function formatRupiah(angka) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(angka);
}

function generateChartURL(timestamps, values, label) {
  const chart = {
    type: "line",
    data: {
      labels: timestamps,
      datasets: [
        {
          label: label,
          data: values,
          fill: false,
          borderColor: "blue",
          tension: 0.1,
        },
      ],
    },
  };
  return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chart))}`;
}

function updateRiwayatCSV(harga, waktu) {
  const row = [
    waktu,
    harga.bitcoin,
    harga.ethereum,
    harga.solana,
    harga.usdt,
  ].join(",");

  if (!fs.existsSync(CSV_PATH)) {
    fs.writeFileSync(
      CSV_PATH,
      "timestamp,bitcoin,ethereum,solana,usdt\n"
    );
  }

  const existing = fs.readFileSync(CSV_PATH, "utf-8").split("\n");
  const last = existing[existing.length - 1];

  if (!last.includes(harga.bitcoin)) {
    fs.appendFileSync(CSV_PATH, row + "\n");
    console.log("📊 Riwayat harga diperbarui.");
  }
}

function updateReadme(harga, waktu) {
  const waktuLokal = new Date(waktu).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
  });

  const lines = fs.readFileSync(CSV_PATH, "utf-8").trim().split("\n").slice(-11);
  const timestamps = lines.slice(1).map((l) => l.split(",")[0].slice(11, 19));
  const btc = lines.slice(1).map((l) => l.split(",")[1]);
  const eth = lines.slice(1).map((l) => l.split(",")[2]);

  const chartBtcUrl = generateChartURL(timestamps, btc, "Bitcoin");
  const chartEthUrl = generateChartURL(timestamps, eth, "Ethereum");

  const konten = `
<!-- HARGA_KRIPTO -->
### 📈 Harga Kripto Terbaru (dalam Rupiah)

| Koin     | Harga         |
|----------|---------------|
| 🟠 Bitcoin (BTC)   | ${formatRupiah(harga.bitcoin)} |
| 🔵 Ethereum (ETH)  | ${formatRupiah(harga.ethereum)} |
| 🟣 Solana (SOL)    | ${formatRupiah(harga.solana)} |
| 🟢 Tether (USDT)   | ${formatRupiah(harga.usdt)} |

<sub>Terakhir diperbarui: ${waktuLokal}</sub>

---

#### 📉 Grafik Harga BTC (10 update terakhir)
![BTC Chart](${chartBtcUrl})

#### 📉 Grafik Harga ETH (10 update terakhir)
![ETH Chart](${chartEthUrl})

<!-- /HARGA_KRIPTO -->
`.trim();

  let readme = fs.readFileSync(README_PATH, "utf-8");
  const regex = /<!-- HARGA_KRIPTO -->(.*?)<!-- \/HARGA_KRIPTO -->/s;

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
    const response = await axios.get(
      "https://api.coingecko.com/api/v3/simple/price",
      {
        params: {
          ids: "bitcoin,ethereum,solana,tether",
          vs_currencies: "idr",
        },
      }
    );

    const dataBaru = {
      waktu: new Date().toISOString(),
      harga: {
        bitcoin: response.data.bitcoin.idr,
        ethereum: response.data.ethereum.idr,
        solana: response.data.solana.idr,
        usdt: response.data.tether.idr,
      },
    };

    let dataLama = {};
    if (fs.existsSync(DATA_PATH)) {
      dataLama = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
    }

    const hargaLama = JSON.stringify(dataLama.harga || {});
    const hargaBaru = JSON.stringify(dataBaru.harga);

    if (hargaLama !== hargaBaru) {
      fs.writeFileSync(DATA_PATH, JSON.stringify(dataBaru, null, 2));
      updateRiwayatCSV(dataBaru.harga, dataBaru.waktu);
      updateReadme(dataBaru.harga, dataBaru.waktu);
    } else {
      console.log("ℹ️ Tidak ada perubahan harga.");
    }
  } catch (err) {
    console.error("❌ Gagal mengambil data:", err.message);
    process.exit(1);
  }
}

ambilKurs();
