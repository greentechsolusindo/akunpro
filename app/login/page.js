'use client'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email atau password salah')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f5f5f5'}}>
      <div style={{background:'white',padding:'40px',borderRadius:'12px',width:'360px',boxShadow:'0 2px 8px rgba(0,0,0,0.08)'}}>
        <h1 style={{fontSize:'22px',fontWeight:'500',marginBottom:'8px'}}>AkunPro</h1>
        <p style={{color:'#888',fontSize:'13px',marginBottom:'24px'}}>Masuk ke akun Anda</p>
        <form onSubmit={handleLogin}>
          <div style={{marginBottom:'14px'}}>
            <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'6px'}}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
              style={{width:'100%',padding:'9px 12px',border:'1px solid #ddd',borderRadius:'8px',fontSize:'14px'}}
              required />
          </div>
          <div style={{marginBottom:'20px'}}>
            <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'6px'}}>Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
              style={{width:'100%',padding:'9px 12px',border:'1px solid #ddd',borderRadius:'8px',fontSize:'14px'}}
              required />
          </div>
          {error && <p style={{color:'red',fontSize:'13px',marginBottom:'12px'}}>{error}</p>}
          <button type="submit" disabled={loading}
            style={{width:'100%',padding:'10px',background:'#2563eb',color:'white',border:'none',borderRadius:'8px',fontSize:'14px',cursor:'pointer'}}>
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  )
}
