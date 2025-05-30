import React from 'react';
import { Metadata } from 'next';
import NewUserClient from './NewUserClient';

export const metadata: Metadata = {
  title: 'New User | Admin Dashboard',
  description: 'Create a new driver or helpdesk user account.',
};

const NewUserPage = () => {
  return <NewUserClient />;
};

export default NewUserPage;