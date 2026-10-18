import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Hà Nội · Ca đêm',description:'Game dọn phố Hà Nội 3D với góc nhìn thứ ba/thứ nhất: quét lá thành đống, hốt lên xe, bàn giao rác và lội nước thông cống.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="vi"><body>{children}</body></html>; }
