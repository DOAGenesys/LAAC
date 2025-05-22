import Image from 'next/image';

const Header = () => {
  return (
    <header className="bg-black text-white p-4 flex items-center">
      <Image
        src="/Genesys_logo.jpg"
        alt="Genesys Logo"
        width={150} // Adjust width as needed
        height={50} // Adjust height as needed
        priority // Prioritize loading the logo
      />
      {/* You can add other header elements here, like navigation links */}
    </header>
  );
};

export default Header; 