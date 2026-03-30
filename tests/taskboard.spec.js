import { test, expect } from '@playwright/test';

test('muestra login y permite cambiar a registro', async ({ page }) => {
  await page.goto('http://localhost:3000/');

  await expect(page.getByRole('heading', { name: 'Bienvenido de nuevo' })).toBeVisible();
  await expect(page.getByText('Inicia sesión para acceder a tus tableros.')).toBeVisible();
  await expect(page.locator('#email')).toBeVisible();
  await expect(page.locator('#password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Iniciar sesión', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Iniciar sesión con Google' })).toBeVisible();

  await page.getByRole('button', { name: 'Regístrate aquí' }).click();

  await expect(page.getByRole('heading', { name: 'Crea tu cuenta' })).toBeVisible();
  await expect(page.getByText('Únete a Taskboard y empieza a organizar tus tareas hoy mismo.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Registrarse', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Registrarse con Google' })).toBeVisible();
});