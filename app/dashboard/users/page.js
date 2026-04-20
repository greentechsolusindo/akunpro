'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nama, setNama] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const S = {
    card: {background:'white',borderRadius:'10px',border:'1px solid #e2e8f0',marginBottom:'20px'},
    cardHead: {padding:'14px 16px',borderBottom:'1px solid #f1f5f9',fontSize:'14px',fontWeight:'500'},
    table: {width:'100%',borderCollapse:'collapse',fontSize:'13px'},
    th: {textAlign:'left',padding:'8px 16px',color:'#64748b',fontWeight:'500',fontSize:'12px',borderBottom:'1px solid #f1f5f9'},
    td: {padding:'10px 16px',borderBottom:'1px solid #f8fafc'},
    input: {width:'100%',padding:'8px 10px',border:'1px solid #e2e8f0',borderRadius:'7px',fontSize:'13px'},
    label: {fontSize:'12px',color:'#64748b',marginBottom:'4px',display:'block'},
    btn: {fontSize:'13px',padding:'8px 18px',borderRadius:'7px',cursor:'pointer',border:'none',background:'#3b82f6',color:'white',fontWeight:'500'},
  }

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    const { data } = await supabase.from('profiles').select('*').order('created_at')
    setUsers(data || [])
  }

  async function tambahUser() {
    if (!email || !password || !nama) { setMsg('Isi semua field!'); return }
    setLoading(true)
    // Daftar user baru via Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { nama } }
    })
    if (error) { setMsg('Error: ' + error.message); setLoading(false); return }
    // Simpan profil
    if (data.user) {
      await supabase.from('profiles').upsert({ id: data.user.id, nama, role: 'staff' })
    }
    setEmail(''); setPassword(''); setNama('')
    setMsg('User berhasil ditambahkan!')
    setTimeout(() => setMsg(''), 3000)
    setLoading(false)
    loadUsers()
  }

  return (
    <div style={{padding:'24px',fontFamily:'system-ui,sans-serif'}}>
      <p style={{fontSize:'18px',fontWeight:'500',marginBottom:'20px'}}>Manajemen pengguna</p>

      <div style={S.card}>
        <div style={S.cardHead}>Tambah pengguna baru</div>
        <div style={{padding:'16px',display:'grid',gridTemplateColumns:'1fr 1fr 1fr auto',gap:'12px',alignItems:'flex-end'}}>
          <div>
            <label style={S.label}>Nama</label>
            <input style={S.input} value={nama} onChange={e=>setNama(e.target.value)} placeholder="Nama lengkap"/>
          </div>
          <div>
            <label style={S.label}>Email</label>
            <input style={S.input} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@contoh.com"/>
          </div>
          <div>
            <label style={S.label}>Password</label>
            <input style={S.input} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Min. 6 karakter"/>
          </div>
          <button style={S.btn} onClick={tambahUser} disabled={loading}>
            {loading ? 'Memproses...' : 'Tambah'}
          </button>
        </div>
        {msg && <p style={{padding:'0 16px 12px',fontSize:'13px',color:msg.includes('Error')?'#dc2626':'#16a34a'}}>{msg}</p>}
      </div>

      <div style={S.card}>
        <div style={S.cardHead}>Daftar pengguna ({users.length})</div>
        <table style={S.table}>
          <thead><tr>
            <th style={S.th}>Nama</th>
            <th style={S.th}>Role</th>
            <th style={S.th}>Bergabung</th>
          </tr></thead>
          <tbody>{users.map(u=><tr key={u.id}>
            <td style={S.td}>{u.nama}</td>
            <td style={S.td}>
              <span style={{background:u.role==='admin'?'#dbeafe':'#f1f5f9',color:u.role==='admin'?'#1d4ed8':'#475569',fontSize:'11px',padding:'2px 8px',borderRadius:'999px'}}>
                {u.role}
              </span>
            </td>
            <td style={S.td}>{u.created_at?.slice(0,10)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  )
}
