# Cloudflare Site Builder

нужно создать сервис в который пользователь будет загружать вот такие файлы. Сервис анализирует их, смотрит что не хватает для того чтобы успешно разместить его в cloudflare pages как полноценный сайт. Если чтото не хватает, он это автоматически исправляет, добавляет файлы которые нужны, правит код если надо, и после всех манипуляций создает сайт на Cloudflare pages с сайтом который был в архиве. Как итог пользователь получает рабочую ссылку сайта, статус, и кнопки управления сайтом. Так же по возможности если останутся токены нужно сделать возможность менять изображения на сайтах там где можно, текст исправлять а для навигационных кнопок делать заглушку.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://cloudflarepager.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e9f1d004-3641-485c-92ac-12618269d7f3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
