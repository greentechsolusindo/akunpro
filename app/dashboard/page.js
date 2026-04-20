'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const [menu, setMenu] = useState('dashboard')
  const [user, setUser] = useState(null)
  const router = useRouter()

  // Data states
  const [produk, setProduk] = useState([])
  const [pelanggan, setPelanggan] = useState([])
  const [supplier, setSupplier] = useState([])
  const [penjualan, setPenjualan] = useState([])
  const [pembelian, setPembelian] = useState([])
  const [kas, setKas] = useState([])
  const [mutasi, setMutasi] = useState([])
  const [piutang, setPiutang] = useState([])
  const [hutang, setHutang] = useState([])

  // Form states
  const [form, setForm] = useState({})
  const [formDetail, setFormDetail] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/login')
      else { setUser(data.user); loadAll() }
    })
  }, [])

  async function loadAll() {
    const [p, pl, sp, penj, pemb, k, mut] = await Promise.all([
      supabase.from('produk').select('*').order('nama'),
      supabase.from('pelanggan').select('*').order('nama'),
      supabase.from('supplier').select('*').order('nama'),
      supabase.from('penjualan').select('*, pelanggan(nama)').order('tanggal', {ascending:false}),
      supabase.from('pembelian').select('*, supplier(nama)').order('tanggal', {ascending:false}),
      supabase.from('kas').select('*'),
      supabase.from('mutasi_kas').select('*, kas(nama)').order('tanggal', {ascending:false}).limit(50),
    ])
    setProduk(p.data||[])
    setPelanggan(pl.data||[])
    setSupplier(sp.data||[])
    setPenjualan(penj.data||[])
    setPembelian(pemb.data||[])
    setKas(k.data||[])
    setMutasi(mut.data||[])
    setPiutang((penj.data||[]).filter(x => x.status !== 'lunas'))
    setHutang((pemb.data||[]).filter(x => x.status !== 'lunas'))
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ---- HELPERS ----
  const rp = n => 'Rp ' + Number(n||0).toLocaleString('id-ID')
  const nowDate = () => new Date().toISOString().slice(0,10)
  const nomor = (prefix) => prefix + '-' + Date.now().toString().slice(-6)
  function notify(m) { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  // ---- PRODUK CRUD ----
  async function saveProduk() {
    setLoading(true)
    const d = { kode: form.kode, nama: form.nama, satuan: form.satuan,
      harga_beli: +form.harga_beli||0, harga_jual: +form.harga_jual||0,
      stok: +form.stok||0, stok_min: +form.stok_min||10 }
    if (form.id) await supabase.from('produk').update(d).eq('id', form.id)
    else await supabase.from('produk').insert(d)
    setShowForm(false); setForm({}); loadAll(); setLoading(false)
    notify(form.id ? 'Produk diperbarui' : 'Produk ditambahkan')
  }

  async function deleteProduk(id) {
    if (!confirm('Hapus produk ini?')) return
    await supabase.from('produk').delete().eq('id', id)
    loadAll(); notify('Produk dihapus')
  }

  // ---- PELANGGAN CRUD ----
  async function savePelanggan() {
    setLoading(true)
    const d = { kode: form.kode, nama: form.nama, telepon: form.telepon||'', alamat: form.alamat||'' }
    if (form.id) await supabase.from('pelanggan').update(d).eq('id', form.id)
    else await supabase.from('pelanggan').insert(d)
    setShowForm(false); setForm({}); loadAll(); setLoading(false)
    notify('Data pelanggan disimpan')
  }

  // ---- SUPPLIER CRUD ----
  async function saveSupplier() {
    setLoading(true)
    const d = { kode: form.kode, nama: form.nama, telepon: form.telepon||'', alamat: form.alamat||'' }
    if (form.id) await supabase.from('supplier').update(d).eq('id', form.id)
    else await supabase.from('supplier').insert(d)
    setShowForm(false); setForm({}); loadAll(); setLoading(false)
    notify('Data supplier disimpan')
  }

  // ---- PENJUALAN ----
  function addDetailItem() {
    setFormDetail([...formDetail, { produk_id:'', qty:1, harga:0, subtotal:0 }])
  }
  function updateDetail(i, key, val) {
    const d = [...formDetail]
    d[i][key] = val
    if (key === 'produk_id') {
      const p = produk.find(x => x.id === val)
      if (p) d[i].harga = p.harga_jual
    }
    d[i].subtotal = (d[i].qty||0) * (d[i].harga||0)
    setFormDetail(d)
  }
  const totalDetail = formDetail.reduce((s,x) => s + (+x.subtotal||0), 0)

  async function savePenjualan() {
    setLoading(true)
    const total = totalDetail
    const bayar = +form.bayar||0
    const status = bayar >= total ? 'lunas' : bayar > 0 ? 'sebagian' : 'belum_lunas'
    const { data: penj } = await supabase.from('penjualan').insert({
      nomor: nomor('INV'), tanggal: form.tanggal||nowDate(),
      pelanggan_id: form.pelanggan_id, total, bayar, status, catatan: form.catatan||''
    }).select().single()
    if (penj) {
      await supabase.from('penjualan_detail').insert(
        formDetail.map(d => ({ penjualan_id: penj.id, produk_id: d.produk_id, qty: +d.qty, harga: +d.harga, subtotal: +d.subtotal }))
      )
      // Update stok
      for (const d of formDetail) {
        const p = produk.find(x => x.id === d.produk_id)
        if (p) await supabase.from('produk').update({ stok: p.stok - (+d.qty) }).eq('id', p.id)
      }
      // Catat kas jika ada pembayaran
      if (bayar > 0 && kas[0]) {
        await supabase.from('mutasi_kas').insert({
          kas_id: kas[0].id, tanggal: form.tanggal||nowDate(),
          jenis: 'masuk', jumlah: bayar, keterangan: 'Penjualan ' + penj.nomor, ref_id: penj.id
        })
        await supabase.from('kas').update({ saldo: kas[0].saldo + bayar }).eq('id', kas[0].id)
      }
    }
    setShowForm(false); setForm({}); setFormDetail([]); loadAll(); setLoading(false)
    notify('Penjualan berhasil disimpan')
  }

  // ---- PEMBELIAN ----
  async function savePembelian() {
    setLoading(true)
    const total = totalDetail
    const bayar = +form.bayar||0
    const status = bayar >= total ? 'lunas' : bayar > 0 ? 'sebagian' : 'belum_lunas'
    const { data: pemb } = await supabase.from('pembelian').insert({
      nomor: nomor('PO'), tanggal: form.tanggal||nowDate(),
      supplier_id: form.supplier_id, total, bayar, status, catatan: form.catatan||''
    }).select().single()
    if (pemb) {
      await supabase.from('pembelian_detail').insert(
        formDetail.map(d => ({ pembelian_id: pemb.id, produk_id: d.produk_id, qty: +d.qty, harga: +d.harga, subtotal: +d.subtotal }))
      )
      // Update stok
      for (const d of formDetail) {
        const p = produk.find(x => x.id === d.produk_id)
        if (p) await supabase.from('produk').update({ stok: p.stok + (+d.qty) }).eq('id', p.id)
      }
      // Catat kas jika ada pembayaran
      if (bayar > 0 && kas[0]) {
        await supabase.from('mutasi_kas').insert({
          kas_id: kas[0].id, tanggal: form.tanggal||nowDate(),
          jenis: 'keluar', jumlah: bayar, keterangan: 'Pembelian ' + pemb.nomor, ref_id: pemb.id
        })
        await supabase.from('kas').update({ saldo: kas[0].saldo - bayar }).eq('id', kas[0].id)
      }
    }
    setShowForm(false); setForm({}); setFormDetail([]); loadAll(); setLoading(false)
    notify('Pembelian berhasil disimpan')
  }

  // ---- PELUNASAN ----
  async function lunasi(tipe, row) {
    const sisa = row.total - row.bayar
    const input = prompt(`Bayar sisa ${rp(sisa)}? Masukkan jumlah:`, sisa)
    if (!input) return
    const jumlah = Math.min(+input, sisa)
    const newBayar = row.bayar + jumlah
    const status = newBayar >= row.total ? 'lunas' : 'sebagian'
    await supabase.from(tipe).update({ bayar: newBayar, status }).eq('id', row.id)
    if (kas[0]) {
      const jenis = tipe === 'penjualan' ? 'masuk' : 'keluar'
      await supabase.from('mutasi_kas').insert({
        kas_id: kas[0].id, tanggal: nowDate(), jenis, jumlah,
        keterangan: 'Pelunasan ' + row.nomor, ref_id: row.id
      })
      const newSaldo = jenis === 'masuk' ? kas[0].saldo + jumlah : kas[0].saldo - jumlah
      await supabase.from('kas').update({ saldo: newSaldo }).eq('id', kas[0].id)
    }
    loadAll(); notify('Pelunasan berhasil')
  }

  // ---- STATS ----
  const totalPenjualan = penjualan.reduce((s,x) => s+x.total, 0)
  const totalPiutang = piutang.reduce((s,x) => s+(x.total-x.bayar), 0)
  const totalHutang = hutang.reduce((s,x) => s+(x.total-x.bayar), 0)
  const totalKas = kas.reduce((s,x) => s+x.saldo, 0)
  const stokKritis = produk.filter(p => p.stok <= p.stok_min)

  // ---- BADGE ----
  function badge(s) {
    const map = { lunas:{bg:'#dcfce7',c:'#166534',t:'Lunas'}, sebagian:{bg:'#fef9c3',c:'#854d0e',t:'Sebagian'}, belum_lunas:{bg:'#fee2e2',c:'#991b1b',t:'Belum lunas'} }
    const m = map[s]||{bg:'#f3f4f6',c:'#374151',t:s}
    return <span style={{background:m.bg,color:m.c,fontSize:'11px',padding:'2px 8px',borderRadius:'999px'}}>{m.t}</span>
  }

  // ---- STYLES ----
  const S = {
    app: {display:'flex',minHeight:'100vh',fontFamily:'system-ui,sans-serif'},
    sidebar: {width:'200px',background:'#1e293b',color:'white',padding:'0',flexShrink:0},
    logo: {padding:'20px 16px 16px',borderBottom:'1px solid #334155'},
    logoTitle: {fontSize:'16px',fontWeight:'600'},
    logoSub: {fontSize:'11px',color:'#94a3b8',marginTop:'2px'},
    navSection: {fontSize:'10px',color:'#64748b',padding:'14px 16px 4px',letterSpacing:'0.08em',textTransform:'uppercase'},
    navItem: (active) => ({display:'flex',alignItems:'center',gap:'8px',padding:'8px 16px',cursor:'pointer',fontSize:'13px',color:active?'white':'#94a3b8',background:active?'#3b82f6':'transparent',borderRadius:'0'}),
    main: {flex:1,background:'#f8fafc',overflow:'auto'},
    topbar: {background:'white',borderBottom:'1px solid #e2e8f0',padding:'12px 24px',display:'flex',justifyContent:'space-between',alignItems:'center'},
    content: {padding:'24px'},
    pageTitle: {fontSize:'18px',fontWeight:'500',marginBottom:'20px'},
    statsGrid: {display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'24px'},
    statCard: {background:'white',borderRadius:'10px',padding:'16px',border:'1px solid #e2e8f0'},
    statLabel: {fontSize:'12px',color:'#64748b',marginBottom:'6px'},
    statVal: (c) => ({fontSize:'18px',fontWeight:'600',color:c||'#1e293b'}),
    card: {background:'white',borderRadius:'10px',border:'1px solid #e2e8f0',marginBottom:'16px'},
    cardHead: {display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 16px',borderBottom:'1px solid #f1f5f9'},
    cardTitle: {fontSize:'14px',fontWeight:'500'},
    table: {width:'100%',borderCollapse:'collapse',fontSize:'13px'},
    th: {textAlign:'left',padding:'8px 16px',color:'#64748b',fontWeight:'500',fontSize:'12px',borderBottom:'1px solid #f1f5f9'},
    td: {padding:'10px 16px',borderBottom:'1px solid #f8fafc'},
    btn: (c) => ({fontSize:'12px',padding:'6px 14px',borderRadius:'7px',cursor:'pointer',border:'none',fontWeight:'500',background:c||'#3b82f6',color:'white'}),
    btnSm: {fontSize:'11px',padding:'3px 8px',borderRadius:'5px',cursor:'pointer',border:'1px solid #e2e8f0',background:'white',color:'#374151'},
    input: {width:'100%',padding:'8px 10px',border:'1px solid #e2e8f0',borderRadius:'7px',fontSize:'13px'},
    label: {fontSize:'12px',color:'#64748b',marginBottom:'4px',display:'block'},
    formGrid: {display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'},
    overlay: {position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center'},
    modal: {background:'white',borderRadius:'12px',padding:'24px',width:'520px',maxHeight:'85vh',overflow:'auto'},
    modalTitle: {fontSize:'16px',fontWeight:'600',marginBottom:'20px'},
  }

  // ---- FORM INPUT COMPONENT ----
  function FInput({label, fkey, type='text', ...rest}) {
    return <div>
      <label style={S.label}>{label}</label>
      <input type={type} style={S.input} value={form[fkey]||''}
        onChange={e=>setForm({...form,[fkey]:e.target.value})} {...rest}/>
    </div>
  }
  function FSelect({label, fkey, options, valKey='id', labelKey='nama'}) {
    return <div>
      <label style={S.label}>{label}</label>
      <select style={S.input} value={form[fkey]||''} onChange={e=>setForm({...form,[fkey]:e.target.value})}>
        <option value="">-- Pilih --</option>
        {options.map(o=><option key={o[valKey]} value={o[valKey]}>{o[labelKey]}</option>)}
      </select>
    </div>
  }

  // ---- RENDER PAGES ----
  function PageDashboard() {
    return <div>
      <p style={S.pageTitle}>Dashboard</p>
      <div style={S.statsGrid}>
        <div style={S.statCard}><div style={S.statLabel}>Total penjualan</div><div style={S.statVal('#16a34a')}>{rp(totalPenjualan)}</div></div>
        <div style={S.statCard}><div style={S.statLabel}>Piutang</div><div style={S.statVal('#2563eb')}>{rp(totalPiutang)}</div></div>
        <div style={S.statCard}><div style={S.statLabel}>Hutang</div><div style={S.statVal('#dc2626')}>{rp(totalHutang)}</div></div>
        <div style={S.statCard}><div style={S.statLabel}>Saldo kas</div><div style={S.statVal()}>{rp(totalKas)}</div></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>
        <div style={S.card}>
          <div style={S.cardHead}><span style={S.cardTitle}>Transaksi terakhir</span></div>
          <table style={S.table}><thead><tr><th style={S.th}>Tanggal</th><th style={S.th}>Keterangan</th><th style={S.th}>Jumlah</th></tr></thead>
            <tbody>{mutasi.slice(0,6).map(m=><tr key={m.id}>
              <td style={S.td}>{m.tanggal}</td>
              <td style={S.td}>{m.keterangan}</td>
              <td style={{...S.td,color:m.jenis==='masuk'?'#16a34a':'#dc2626'}}>{m.jenis==='masuk'?'+':'-'}{rp(m.jumlah)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <div style={S.card}>
          <div style={S.cardHead}><span style={S.cardTitle}>Stok kritis ({stokKritis.length})</span></div>
          <table style={S.table}><thead><tr><th style={S.th}>Produk</th><th style={S.th}>Stok</th><th style={S.th}>Min</th></tr></thead>
            <tbody>{stokKritis.map(p=><tr key={p.id}>
              <td style={S.td}>{p.nama}</td>
              <td style={{...S.td,color:'#dc2626',fontWeight:'500'}}>{p.stok} {p.satuan}</td>
              <td style={S.td}>{p.stok_min}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  }

  function PageProduk() {
    return <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
        <p style={S.pageTitle}>Stok & Produk</p>
        <button style={S.btn()} onClick={()=>{setForm({});setShowForm('produk')}}>+ Produk baru</button>
      </div>
      <div style={S.card}>
        <table style={S.table}>
          <thead><tr>{['Kode','Nama','Satuan','Harga Beli','Harga Jual','Stok','Aksi'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{produk.map(p=><tr key={p.id}>
            <td style={S.td}>{p.kode}</td>
            <td style={S.td}>{p.nama}</td>
            <td style={S.td}>{p.satuan}</td>
            <td style={S.td}>{rp(p.harga_beli)}</td>
            <td style={S.td}>{rp(p.harga_jual)}</td>
            <td style={{...S.td,color:p.stok<=p.stok_min?'#dc2626':'inherit',fontWeight:p.stok<=p.stok_min?'600':'400'}}>{p.stok}</td>
            <td style={S.td}>
              <button style={S.btnSm} onClick={()=>{setForm(p);setShowForm('produk')}}>Edit</button>
              <button style={{...S.btnSm,marginLeft:'6px',color:'#dc2626'}} onClick={()=>deleteProduk(p.id)}>Hapus</button>
            </td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  }

  function PagePenjualan() {
    return <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
        <p style={S.pageTitle}>Penjualan</p>
        <button style={S.btn()} onClick={()=>{setForm({tanggal:nowDate()});setFormDetail([{produk_id:'',qty:1,harga:0,subtotal:0}]);setShowForm('penjualan')}}>+ Faktur baru</button>
      </div>
      <div style={S.card}>
        <table style={S.table}>
          <thead><tr>{['Nomor','Tanggal','Pelanggan','Total','Bayar','Status','Aksi'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{penjualan.map(r=><tr key={r.id}>
            <td style={S.td}>{r.nomor}</td>
            <td style={S.td}>{r.tanggal}</td>
            <td style={S.td}>{r.pelanggan?.nama||'-'}</td>
            <td style={S.td}>{rp(r.total)}</td>
            <td style={S.td}>{rp(r.bayar)}</td>
            <td style={S.td}>{badge(r.status)}</td>
            <td style={S.td}>{r.status!=='lunas'&<button style={S.btnSm} onClick={()=>lunasi('penjualan',r)}>Lunasi</button>}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  }

  function PagePembelian() {
    return <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
        <p style={S.pageTitle}>Pembelian</p>
        <button style={S.btn()} onClick={()=>{setForm({tanggal:nowDate()});setFormDetail([{produk_id:'',qty:1,harga:0,subtotal:0}]);setShowForm('pembelian')}}>+ Order baru</button>
      </div>
      <div style={S.card}>
        <table style={S.table}>
          <thead><tr>{['Nomor','Tanggal','Supplier','Total','Bayar','Status','Aksi'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{pembelian.map(r=><tr key={r.id}>
            <td style={S.td}>{r.nomor}</td>
            <td style={S.td}>{r.tanggal}</td>
            <td style={S.td}>{r.supplier?.nama||'-'}</td>
            <td style={S.td}>{rp(r.total)}</td>
            <td style={S.td}>{rp(r.bayar)}</td>
            <td style={S.td}>{badge(r.status)}</td>
            <td style={S.td}>{r.status!=='lunas'&<button style={S.btnSm} onClick={()=>lunasi('pembelian',r)}>Lunasi</button>}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  }

  function PageKas() {
    return <div>
      <p style={S.pageTitle}>Kas & Bank</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'12px',marginBottom:'20px'}}>
        {kas.map(k=><div key={k.id} style={S.statCard}>
          <div style={S.statLabel}>{k.nama}</div>
          <div style={S.statVal()}>{rp(k.saldo)}</div>
        </div>)}
      </div>
      <div style={S.card}>
        <div style={S.cardHead}><span style={S.cardTitle}>Mutasi kas</span></div>
        <table style={S.table}>
          <thead><tr>{['Tanggal','Akun','Keterangan','Masuk','Keluar'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{mutasi.map(m=><tr key={m.id}>
            <td style={S.td}>{m.tanggal}</td>
            <td style={S.td}>{m.kas?.nama}</td>
            <td style={S.td}>{m.keterangan}</td>
            <td style={{...S.td,color:'#16a34a'}}>{m.jenis==='masuk'?rp(m.jumlah):''}</td>
            <td style={{...S.td,color:'#dc2626'}}>{m.jenis==='keluar'?rp(m.jumlah):''}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  }

  function PagePiutang() {
    return <div>
      <p style={S.pageTitle}>Piutang</p>
      <div style={S.card}>
        <table style={S.table}>
          <thead><tr>{['Nomor','Pelanggan','Total','Dibayar','Sisa','Status','Aksi'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{piutang.map(r=><tr key={r.id}>
            <td style={S.td}>{r.nomor}</td>
            <td style={S.td}>{r.pelanggan?.nama||'-'}</td>
            <td style={S.td}>{rp(r.total)}</td>
            <td style={S.td}>{rp(r.bayar)}</td>
            <td style={{...S.td,fontWeight:'600',color:'#dc2626'}}>{rp(r.total-r.bayar)}</td>
            <td style={S.td}>{badge(r.status)}</td>
            <td style={S.td}><button style={S.btnSm} onClick={()=>lunasi('penjualan',r)}>Lunasi</button></td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  }

  function PageHutang() {
    return <div>
      <p style={S.pageTitle}>Hutang</p>
      <div style={S.card}>
        <table style={S.table}>
          <thead><tr>{['Nomor','Supplier','Total','Dibayar','Sisa','Status','Aksi'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{hutang.map(r=><tr key={r.id}>
            <td style={S.td}>{r.nomor}</td>
            <td style={S.td}>{r.supplier?.nama||'-'}</td>
            <td style={S.td}>{rp(r.total)}</td>
            <td style={S.td}>{rp(r.bayar)}</td>
            <td style={{...S.td,fontWeight:'600',color:'#dc2626'}}>{rp(r.total-r.bayar)}</td>
            <td style={S.td}>{badge(r.status)}</td>
            <td style={S.td}><button style={S.btnSm} onClick={()=>lunasi('pembelian',r)}>Lunasi</button></td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  }

  function PageLabaRugi() {
    const penjBulan = penjualan.filter(x => x.tanggal?.slice(0,7) === nowDate().slice(0,7))
    const pembBulan = pembelian.filter(x => x.tanggal?.slice(0,7) === nowDate().slice(0,7))
    const totalPenj = penjBulan.reduce((s,x)=>s+x.total,0)
    const totalPemb = pembBulan.reduce((s,x)=>s+x.total,0)
    const labaKotor = totalPenj - totalPemb
    return <div>
      <p style={S.pageTitle}>Laporan laba rugi</p>
      <div style={{...S.statsGrid,gridTemplateColumns:'repeat(3,1fr)'}}>
        <div style={S.statCard}><div style={S.statLabel}>Pendapatan bulan ini</div><div style={S.statVal('#16a34a')}>{rp(totalPenj)}</div></div>
        <div style={S.statCard}><div style={S.statLabel}>HPP bulan ini</div><div style={S.statVal('#dc2626')}>{rp(totalPemb)}</div></div>
        <div style={S.statCard}><div style={S.statLabel}>Laba kotor</div><div style={S.statVal(labaKotor>=0?'#2563eb':'#dc2626')}>{rp(labaKotor)}</div></div>
      </div>
      <div style={S.card}>
        <div style={S.cardHead}><span style={S.cardTitle}>Rincian bulan ini</span></div>
        <table style={S.table}>
          <tbody>
            <tr><td style={{...S.td,fontWeight:'600'}}>Pendapatan penjualan</td><td style={{...S.td,textAlign:'right',color:'#16a34a'}}>{rp(totalPenj)}</td></tr>
            {penjBulan.map(r=><tr key={r.id}><td style={{...S.td,paddingLeft:'32px',color:'#64748b'}}>{r.nomor} - {r.pelanggan?.nama}</td><td style={{...S.td,textAlign:'right'}}>{rp(r.total)}</td></tr>)}
            <tr><td style={{...S.td,fontWeight:'600'}}>Harga pokok pembelian</td><td style={{...S.td,textAlign:'right',color:'#dc2626'}}>({rp(totalPemb)})</td></tr>
            {pembBulan.map(r=><tr key={r.id}><td style={{...S.td,paddingLeft:'32px',color:'#64748b'}}>{r.nomor} - {r.supplier?.nama}</td><td style={{...S.td,textAlign:'right'}}>({rp(r.total)})</td></tr>)}
            <tr style={{borderTop:'2px solid #e2e8f0'}}>
              <td style={{...S.td,fontWeight:'700',fontSize:'14px'}}>Laba kotor</td>
              <td style={{...S.td,textAlign:'right',fontWeight:'700',fontSize:'14px',color:labaKotor>=0?'#16a34a':'#dc2626'}}>{rp(labaKotor)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  }

  function PagePelanggan() {
    return <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
        <p style={S.pageTitle}>Pelanggan</p>
        <button style={S.btn()} onClick={()=>{setForm({kode:'CUS-'+Date.now().toString().slice(-4)});setShowForm('pelanggan')}}>+ Pelanggan baru</button>
      </div>
      <div style={S.card}>
        <table style={S.table}>
          <thead><tr>{['Kode','Nama','Telepon','Alamat','Aksi'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{pelanggan.map(p=><tr key={p.id}>
            <td style={S.td}>{p.kode}</td><td style={S.td}>{p.nama}</td>
            <td style={S.td}>{p.telepon||'-'}</td><td style={S.td}>{p.alamat||'-'}</td>
            <td style={S.td}><button style={S.btnSm} onClick={()=>{setForm(p);setShowForm('pelanggan')}}>Edit</button></td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  }

  function PageSupplier() {
    return <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
        <p style={S.pageTitle}>Supplier</p>
        <button style={S.btn()} onClick={()=>{setForm({kode:'SUP-'+Date.now().toString().slice(-4)});setShowForm('supplier')}}>+ Supplier baru</button>
      </div>
      <div style={S.card}>
        <table style={S.table}>
          <thead><tr>{['Kode','Nama','Telepon','Alamat','Aksi'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{supplier.map(p=><tr key={p.id}>
            <td style={S.td}>{p.kode}</td><td style={S.td}>{p.nama}</td>
            <td style={S.td}>{p.telepon||'-'}</td><td style={S.td}>{p.alamat||'-'}</td>
            <td style={S.td}><button style={S.btnSm} onClick={()=>{setForm(p);setShowForm('supplier')}}>Edit</button></td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  }

  // ---- MODALS ----
  function ModalProduk() {
    return <div style={S.overlay}><div style={S.modal}>
      <p style={S.modalTitle}>{form.id?'Edit':'Tambah'} Produk</p>
      <div style={S.formGrid}>
        <FInput label="Kode produk" fkey="kode"/>
        <FInput label="Nama produk" fkey="nama"/>
        <FInput label="Satuan" fkey="satuan"/>
        <FInput label="Stok awal" fkey="stok" type="number"/>
        <FInput label="Stok minimum" fkey="stok_min" type="number"/>
        <FInput label="Harga beli" fkey="harga_beli" type="number"/>
        <FInput label="Harga jual" fkey="harga_jual" type="number"/>
      </div>
      <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
        <button style={S.btn('#64748b')} onClick={()=>setShowForm(false)}>Batal</button>
        <button style={S.btn()} onClick={saveProduk} disabled={loading}>{loading?'Menyimpan...':'Simpan'}</button>
      </div>
    </div></div>
  }

  function ModalPelanggan() {
    return <div style={S.overlay}><div style={S.modal}>
      <p style={S.modalTitle}>{form.id?'Edit':'Tambah'} Pelanggan</p>
      <div style={S.formGrid}>
        <FInput label="Kode" fkey="kode"/>
        <FInput label="Nama" fkey="nama"/>
        <FInput label="Telepon" fkey="telepon"/>
        <FInput label="Alamat" fkey="alamat"/>
      </div>
      <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
        <button style={S.btn('#64748b')} onClick={()=>setShowForm(false)}>Batal</button>
        <button style={S.btn()} onClick={savePelanggan} disabled={loading}>Simpan</button>
      </div>
    </div></div>
  }

  function ModalSupplier() {
    return <div style={S.overlay}><div style={S.modal}>
      <p style={S.modalTitle}>{form.id?'Edit':'Tambah'} Supplier</p>
      <div style={S.formGrid}>
        <FInput label="Kode" fkey="kode"/>
        <FInput label="Nama" fkey="nama"/>
        <FInput label="Telepon" fkey="telepon"/>
        <FInput label="Alamat" fkey="alamat"/>
      </div>
      <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
        <button style={S.btn('#64748b')} onClick={()=>setShowForm(false)}>Batal</button>
        <button style={S.btn()} onClick={saveSupplier} disabled={loading}>Simpan</button>
      </div>
    </div></div>
  }

  function ModalTransaksi({tipe}) {
    const isPenj = tipe === 'penjualan'
    return <div style={S.overlay}><div style={{...S.modal,width:'640px'}}>
      <p style={S.modalTitle}>{isPenj?'Faktur Penjualan Baru':'Order Pembelian Baru'}</p>
      <div style={S.formGrid}>
        <FInput label="Tanggal" fkey="tanggal" type="date"/>
        {isPenj
          ? <FSelect label="Pelanggan" fkey="pelanggan_id" options={pelanggan}/>
          : <FSelect label="Supplier" fkey="supplier_id" options={supplier}/>}
      </div>
      <p style={{fontSize:'13px',fontWeight:'500',marginBottom:'8px'}}>Item</p>
      <table style={{...S.table,marginBottom:'12px'}}>
        <thead><tr>
          <th style={S.th}>Produk</th><th style={S.th}>Qty</th><th style={S.th}>Harga</th><th style={S.th}>Subtotal</th>
        </tr></thead>
        <tbody>{formDetail.map((d,i)=><tr key={i}>
          <td style={S.td}>
            <select style={{...S.input,width:'160px'}} value={d.produk_id} onChange={e=>updateDetail(i,'produk_id',e.target.value)}>
              <option value="">-- Pilih --</option>
              {produk.map(p=><option key={p.id} value={p.id}>{p.nama}</option>)}
            </select>
          </td>
          <td style={S.td}><input type="number" style={{...S.input,width:'70px'}} value={d.qty} onChange={e=>updateDetail(i,'qty',e.target.value)}/></td>
          <td style={S.td}><input type="number" style={{...S.input,width:'110px'}} value={d.harga} onChange={e=>updateDetail(i,'harga',e.target.value)}/></td>
          <td style={S.td}>{rp(d.subtotal)}</td>
        </tr>)}</tbody>
      </table>
      <button style={{...S.btn('#e2e8f0'),color:'#374151',marginBottom:'16px'}} onClick={addDetailItem}>+ Tambah item</button>
      <div style={S.formGrid}>
        <div><label style={S.label}>Total</label><p style={{fontSize:'16px',fontWeight:'600'}}>{rp(totalDetail)}</p></div>
        <FInput label="Bayar sekarang" fkey="bayar" type="number"/>
        <div style={{gridColumn:'span 2'}}><FInput label="Catatan" fkey="catatan"/></div>
      </div>
      <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
        <button style={S.btn('#64748b')} onClick={()=>setShowForm(false)}>Batal</button>
        <button style={S.btn()} onClick={isPenj?savePenjualan:savePembelian} disabled={loading}>
          {loading?'Menyimpan...':'Simpan'}
        </button>
      </div>
    </div></div>
  }

  // ---- MAIN RENDER ----
  const navItems = [
    {id:'dashboard',label:'Dashboard',section:'Utama'},
    {id:'penjualan',label:'Penjualan'},
    {id:'pembelian',label:'Pembelian'},
    {id:'stok',label:'Stok'},
    {id:'pelanggan',label:'Pelanggan'},
    {id:'supplier',label:'Supplier'},
    {id:'kas',label:'Kas & Bank',section:'Keuangan'},
    {id:'piutang',label:'Piutang'},
    {id:'hutang',label:'Hutang'},
    {id:'laba',label:'Laba Rugi',section:'Laporan'},
  ]

  return (
    <div style={S.app}>
      <div style={S.sidebar}>
        <div style={S.logo}>
          <p style={S.logoTitle}>AkunPro</p>
          <p style={S.logoSub}>{user?.email}</p>
        </div>
        {navItems.map(n=><div key={n.id}>
          {n.section && <p style={S.navSection}>{n.section}</p>}
          <div style={S.navItem(menu===n.id)} onClick={()=>setMenu(n.id)}>{n.label}</div>
        </div>)}
        <div style={{padding:'16px',marginTop:'auto'}}>
          <button style={{...S.btn('#334155'),width:'100%'}} onClick={logout}>Keluar</button>
        </div>
      </div>
      <div style={S.main}>
        <div style={S.topbar}>
          <span style={{fontSize:'14px',color:'#64748b'}}>{navItems.find(n=>n.id===menu)?.label}</span>
          {msg && <span style={{fontSize:'12px',background:'#dcfce7',color:'#166534',padding:'4px 12px',borderRadius:'999px'}}>{msg}</span>}
        </div>
        <div style={S.content}>
          {menu==='dashboard' && <PageDashboard/>}
          {menu==='stok' && <PageProduk/>}
          {menu==='penjualan' && <PagePenjualan/>}
          {menu==='pembelian' && <PagePembelian/>}
          {menu==='pelanggan' && <PagePelanggan/>}
          {menu==='supplier' && <PageSupplier/>}
          {menu==='kas' && <PageKas/>}
          {menu==='piutang' && <PagePiutang/>}
          {menu==='hutang' && <PageHutang/>}
          {menu==='laba' && <PageLabaRugi/>}
        </div>
      </div>
      {showForm==='produk' && <ModalProduk/>}
      {showForm==='pelanggan' && <ModalPelanggan/>}
      {showForm==='supplier' && <ModalSupplier/>}
      {showForm==='penjualan' && <ModalTransaksi tipe="penjualan"/>}
      {showForm==='pembelian' && <ModalTransaksi tipe="pembelian"/>}
    </div>
  )
}
