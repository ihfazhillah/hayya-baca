import { ISTILAH } from '@/content'
import { DAFTAR_BAHR } from '@/lib/bahr'
import { kitabahBait } from '@/lib/kitabah'
import { timbangBait } from '@/lib/timbang'
import { BankKata } from '@/components/Susun'
import Papan from '@/components/Papan'
import Teks from '@/components/Teks'

export default function Rujukan() {
  return (
    <>
      <section className="judul-halaman">
        <span className="label">Rujukan</span>
        <h1>Notasi, kunci bahr, istilah</h1>
        <p className="lead">Halaman untuk dibuka ulang kapan saja selama course.</p>
      </section>

      <section className="bagian" aria-label="Notasi">
        <div className="bagian-judul"><h2>Notasi</h2></div>
        <div className="tabel-wrap">
          <table>
            <thead><tr><th>Tanda</th><th>Arti</th><th>Contoh</th></tr></thead>
            <tbody>
              <tr><td className="bit">1</td><td>Huruf hidup (berharakat). Di kitab ditulis /.</td><td><Teks>دَ dalam دَارٌ</Teks></td></tr>
              <tr><td className="bit">0</td><td>Huruf mati: sukun, atau huruf mad.</td><td><Teks>ا dalam دَا, نْ dari tanwin</Teks></td></tr>
              <tr><td className="bit">10</td><td>Sabab khafif</td><td><Teks>لَمْ، قَدْ، مَا</Teks></td></tr>
              <tr><td className="bit">110</td><td>Watad majmu'</td><td><Teks>نَعَمْ، عَلَى، لَكُمْ</Teks></td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="bagian" aria-label="Kunci bahr">
        <div className="bagian-judul"><h2>Kunci bahr</h2></div>
        {DAFTAR_BAHR.filter((b) => b.kode !== 'ramalMajzu').map((b) => {
          const k = kitabahBait(b.kunci)
          const h = k.ok ? timbangBait(k.syathr, b) : null
          return (
            <article className="kartu" key={b.kode}>
              <div className="baris-antara">
                <h3>{b.nama}</h3>
                <span className="ar" lang="ar" style={{ fontSize: 22, color: 'var(--heading)' }}>{b.namaAr}</span>
              </div>
              <div className="papan-bait" lang="ar" style={{ fontSize: 24 }}>{b.kunci.map((s, i) => <div key={i}>{s}</div>)}</div>
              {h && (
                <div className="papan">
                  <Papan huruf={h.syathr[0].huruf} kaki={h.syathr[0].potongan} tanda="tampil" juz mizan />
                </div>
              )}
              {b.kode === 'ramal' && <p className="redup kecil">Ramal majzu' memakai dua فَاعِلَاتُنْ per syathr, bukan tiga.</p>}
            </article>
          )
        })}
      </section>

      <section className="bagian" aria-label="Istilah">
        <div className="bagian-judul"><h2>Istilah dan jembatannya</h2></div>
        <div className="tabel-wrap">
          <table>
            <thead><tr><th>Istilah</th><th>Arti</th><th>Jembatan</th></tr></thead>
            <tbody>
              {ISTILAH.map((s) => (
                <tr key={s.istilah}>
                  <td><strong>{s.istilah}</strong><div className="ar redup" lang="ar" style={{ fontSize: 18 }}>{s.ar}</div></td>
                  <td><Teks>{s.arti}</Teks></td>
                  <td><Teks>{s.jembatan}</Teks></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bagian" aria-label="Bank kata">
        <div className="bagian-judul"><h2>Bank kata</h2></div>
        <BankKata />
      </section>
    </>
  )
}
