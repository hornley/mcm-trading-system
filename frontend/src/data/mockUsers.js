import ownerAvatar from '../assets/ownerAvatar.png'
import managerAvatar from '../assets/managerAvatar.png'
import adminAvatar from '../assets/adminAvatar.png'
import staffAvatar from '../assets/staffAvatar.png'

export const mockUsers = [
  {
    username: 'owner1',
    password: '123',
    role: 'owner',
    email: 'owner@gmail.com',
    address: 'here street',
    phoneNumber: '099999999',
    avatar: ownerAvatar,
  },
  {
    username: 'manager1',
    password: '123',
    role: 'manager',
    email: 'manager@gmail.com',
    address: 'there street',
    phoneNumber: '099999998',
    avatar: managerAvatar,
  },
  {
    username: 'admin1',
    password: '123',
    role: 'admin',
    email: 'admin@gmail.com',
    address: 'where street',
    phoneNumber: '099999997',
    avatar: adminAvatar,
  },
]