import type { GetServerSideProps } from 'next'

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: '/admin/orgs', permanent: false },
})

export default function AdminHomeRedirect() {
  return null
}
