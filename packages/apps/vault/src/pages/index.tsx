import type { GetServerSideProps } from 'next'

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: '/vault',
    permanent: false,
  },
})

export default function HomePage() {
  return null
}
