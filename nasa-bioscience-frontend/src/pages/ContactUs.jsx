// src/pages/ContactUs.jsx
import React from 'react';

const ContactUs = () => {
  const teamMembers = [
    {
      name: 'Parth Modi',
      email: 'parthmodi0422@gmail.com',
    },
    {
      name: 'Ayush Pandey',
      email: 'ayushpandey031004@gmail.com',
    },
    {
      name: 'Arihant Kumar Jain',
      email: 'arihantkumarjain@icloud.com',
    },
    {
      name: 'Arya Mundra',
      email: 'aryamundra1@gmail.com',
    }

  ];

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3 px-4">
            Contact Us
          </h1>
          <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto px-4">
            Have questions about our project? Feel free to reach out to us.
          </p>
        </div>

        {/* Team Members Section */}
        <div>
          <div className="text-center mb-8 sm:mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 px-4">Our Team</h2>
            <p className="text-sm sm:text-base text-gray-600 px-4">Student developers working on this project</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {teamMembers.map((member, index) => (
              <div 
                key={index} 
                className="bg-white rounded-lg shadow-md p-5 sm:p-6 hover:shadow-lg transition-shadow"
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gray-900 rounded-full mb-4 flex items-center justify-center text-lg sm:text-xl font-bold text-white">
                  {member.name.split(' ').map(n => n[0]).join('')}
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1">
                  {member.name}
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 mb-1 font-medium">
                  {member.role}
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  {member.department}
                </p>
                
                <div className="pt-4 border-t border-gray-200">
                  <a 
                    href={`mailto:${member.email}`} 
                    className="text-xs sm:text-sm text-gray-700 hover:text-gray-900 break-all block"
                  >
                    {member.email}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactUs;