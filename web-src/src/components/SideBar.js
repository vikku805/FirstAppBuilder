/* 
* <license header>
*/

import React from 'react'
import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Home', end: true },
  { to: '/actions', label: 'Your App Actions' },
  { to: '/about', label: 'About App Builder' },
  { to: '/product', label: 'Products' }
]

function NavItem ({ to, label, end }) {
  return (
    <li className="SideNav-item">
      <NavLink
        className={({ isActive }) => `SideNav-itemLink ${isActive ? 'is-selected' : ''}`}
        aria-current="page"
        end={end}
        to={to}
      >
        {label}
      </NavLink>
    </li>
  )
}

function SideBar () {
  return (
    <ul className="SideNav">
      {navItems.map((item) => (
        <NavItem key={item.to} {...item} />
      ))}
    </ul>
  )
}

export default SideBar
