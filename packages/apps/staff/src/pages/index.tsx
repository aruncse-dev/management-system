import type { GetServerSideProps } from 'next'

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: '/attendance', permanent: false },
})

export default function HomePage() {
  return null
}
