'use server'

import { logout } from './auth'

export async function logoutAction() {
  await logout()
}