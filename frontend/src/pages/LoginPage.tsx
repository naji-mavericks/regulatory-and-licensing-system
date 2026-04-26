import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { api } from '../lib/api'

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  role: z.enum(['operator', 'officer']),
})

type LoginFormData = z.infer<typeof schema>

export default function LoginPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: LoginFormData) => {
    const response = await api.post('/auth/login', data)
    localStorage.setItem('token', response.data.access_token)
    localStorage.setItem('role', data.role)
    window.location.href = data.role === 'officer' ? '/officer' : '/operator'
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 w-80">
        <h1 className="text-2xl font-bold">Login</h1>
        <div className="flex flex-col gap-1">
          <label htmlFor="username">Username</label>
          <input id="username" className="border p-2 rounded" {...register('username')} />
          {errors.username && <p className="text-red-500 text-sm">{errors.username.message}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="role">Role</label>
          <select id="role" className="border p-2 rounded" {...register('role')}>
            <option value="operator">Operator</option>
            <option value="officer">Officer</option>
          </select>
        </div>
        <button type="submit" disabled={isSubmitting} className="bg-slate-900 text-white p-2 rounded">
          Login
        </button>
      </form>
    </div>
  )
}
