import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { api } from '../lib/api'

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormData = z.infer<typeof schema>

export default function LoginPage() {
  const [loginError, setLoginError] = React.useState<string | null>(null)
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<LoginFormData>({ resolver: zodResolver(schema), mode: 'onChange' })

  const onSubmit = async (data: LoginFormData) => {
    setLoginError(null)
    try {
      const response = await api.post('/auth/login', { username: data.username })
      localStorage.setItem('token', response.data.access_token)
      localStorage.setItem('role', response.data.role)
      navigate(response.data.role === 'officer' ? '/officer' : '/operator')
    } catch {
      setLoginError('Login failed. Please try again.')
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-bold">Regulatory &amp; Licensing System</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 w-80">
        <h1 className="text-2xl font-bold">Login</h1>
        <div className="flex flex-col gap-1">
          <label htmlFor="username">Username</label>
          <input id="username" className="border p-2 rounded" {...register('username')} />
          {errors.username && <p className="text-red-500 text-sm">{errors.username.message}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" className="border p-2 rounded" {...register('password')} />
          {errors.password && <p className="text-red-500 text-sm">{errors.password.message}</p>}
        </div>
        {loginError && <p className="text-red-500 text-sm">{loginError}</p>}
        <button type="submit" disabled={isSubmitting || !isValid} className="bg-slate-900 text-white p-2 rounded">
          Login
        </button>
      </form>
    </div>
  )
}
