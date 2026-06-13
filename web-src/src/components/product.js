import React, { useState } from 'react'
import {
  Button,
  Content,
  Flex,
  Heading,
  Item,
  ProgressCircle,
  TabList,
  TabPanels,
  Tabs,
  Text,
  TextField,
  View
} from '@adobe/react-spectrum'
import { useCommerceProduct } from '../hooks/useCommerceProduct.js'
import { useCreateProduct } from '../hooks/useCreateProduct.js'
import { useUpdateProduct } from '../hooks/useUpdateProduct.js'

const FetchProductPanel = (props) => {
  const [sku, setSku] = useState('test-1')
  const [submittedSku, setSubmittedSku] = useState('')
  const { product } = useCommerceProduct({ ...props }, submittedSku)

  return (
    <View>
      <TextField label="Product SKU" value={sku} onChange={setSku} marginBottom={10} />
      <Flex>
        <Button variant="cta" onPress={() => setSubmittedSku(sku)}>Fetch Product</Button>
      </Flex>
      <Content marginTop={10}>{product && product.name ? product.name : ''}</Content>
    </View>
  )
}

const CreateProductPanel = (props) => {
  const [sku, setSku] = useState('')
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [categories, setCategories] = useState('')
  const { createProduct, loading, result, errors } = useCreateProduct({ ...props })

  const handleCreate = () => {
    createProduct({ sku, name, price, quantity, categories })
  }

  const stockItem = result && result.extension_attributes && result.extension_attributes.stock_item
  const createdQty = stockItem ? stockItem.qty : 0
  const salableQty = result && (result.salable_quantity !== undefined && result.salable_quantity !== null)
    ? result.salable_quantity
    : 'n/a'
  const categoryLinks = result && result.extension_attributes && result.extension_attributes.category_links
  const assignedCategories = categoryLinks && categoryLinks.length
    ? categoryLinks.map((c) => c.category_id).join(', ')
    : 'none'

  return (
    <View>
      <Flex direction="column" gap="size-100" maxWidth="size-4600">
        <TextField label="SKU" value={sku} onChange={setSku} isRequired />
        <TextField label="Name" value={name} onChange={setName} isRequired />
        <TextField label="Price" value={price} onChange={setPrice} isRequired inputMode="decimal" />
        <TextField label="Quantity" value={quantity} onChange={setQuantity} inputMode="numeric" />
        <TextField
          label="Categories"
          description="Comma-separated category IDs, e.g. 3, 4"
          value={categories}
          onChange={setCategories}
        />
        <Flex alignItems="center" gap="size-150" marginTop={10}>
          <Button variant="cta" onPress={handleCreate} isDisabled={loading}>Create Product</Button>
          {loading && <ProgressCircle size="S" aria-label="Creating product" isIndeterminate />}
        </Flex>

        {errors && errors.length > 0 && (
          <View backgroundColor="negative" padding="size-100" borderRadius="medium" marginTop={10}>
            {errors.map((e, i) => (
              <Content key={i}><Text>{e}</Text></Content>
            ))}
          </View>
        )}

        {result && !result.error && (
          <View backgroundColor="positive" padding="size-100" borderRadius="medium" marginTop={10}>
            <Content>
              <Text>
                Created product "{result.name}" (SKU: {result.sku}, ID: {result.id}) —
                Quantity: {createdQty}, Salable quantity: {salableQty}, Categories: {assignedCategories}
              </Text>
            </Content>
          </View>
        )}

        {result && result.error && (
          <View backgroundColor="negative" padding="size-100" borderRadius="medium" marginTop={10}>
            <Content>
              <Text>Error: {typeof result.error === 'string' ? result.error : JSON.stringify(result.error)}</Text>
            </Content>
          </View>
        )}
      </Flex>
    </View>
  )
}

const UpdateProductPanel = (props) => {
  const [sku, setSku] = useState('')
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [categories, setCategories] = useState('')
  const { updateProduct, loading, result, errors } = useUpdateProduct({ ...props })

  const handleUpdate = () => {
    updateProduct({ sku, name, price, quantity, categories })
  }

  const stockItem = result && result.extension_attributes && result.extension_attributes.stock_item
  const updatedQty = stockItem ? stockItem.qty : 'unchanged'
  const categoryLinks = result && result.extension_attributes && result.extension_attributes.category_links
  const assignedCategories = categoryLinks && categoryLinks.length
    ? categoryLinks.map((c) => c.category_id).join(', ')
    : 'unchanged'

  return (
    <View>
      <Flex direction="column" gap="size-100" maxWidth="size-4600">
        <TextField label="SKU" description="The SKU of the product to update" value={sku} onChange={setSku} isRequired />
        <TextField label="Name" description="Leave blank to keep unchanged" value={name} onChange={setName} />
        <TextField label="Price" description="Leave blank to keep unchanged" value={price} onChange={setPrice} inputMode="decimal" />
        <TextField label="Quantity" description="Leave blank to keep unchanged" value={quantity} onChange={setQuantity} inputMode="numeric" />
        <TextField
          label="Categories"
          description="Comma-separated category IDs (replaces existing). Leave blank to keep unchanged"
          value={categories}
          onChange={setCategories}
        />
        <Flex alignItems="center" gap="size-150" marginTop={10}>
          <Button variant="cta" onPress={handleUpdate} isDisabled={loading}>Update Product</Button>
          {loading && <ProgressCircle size="S" aria-label="Updating product" isIndeterminate />}
        </Flex>

        {errors && errors.length > 0 && (
          <View backgroundColor="negative" padding="size-100" borderRadius="medium" marginTop={10}>
            {errors.map((e, i) => (
              <Content key={i}><Text>{e}</Text></Content>
            ))}
          </View>
        )}

        {result && !result.error && (
          <View backgroundColor="positive" padding="size-100" borderRadius="medium" marginTop={10}>
            <Content>
              <Text>
                Updated product "{result.name}" (SKU: {result.sku}, ID: {result.id}) —
                Price: {result.price}, Quantity: {updatedQty}, Categories: {assignedCategories}
              </Text>
            </Content>
          </View>
        )}

        {result && result.error && (
          <View backgroundColor="negative" padding="size-100" borderRadius="medium" marginTop={10}>
            <Content>
              <Text>Error: {typeof result.error === 'string' ? result.error : JSON.stringify(result.error)}</Text>
            </Content>
          </View>
        )}
      </Flex>
    </View>
  )
}

export const Product = (props) => {
  return (
    <View>
      <Heading level={2}>Products</Heading>
      <Tabs aria-label="Product operations">
        <TabList>
          <Item key="fetch">Fetch Product</Item>
          <Item key="create">Create Product</Item>
          <Item key="update">Update Product</Item>
        </TabList>
        <TabPanels>
          <Item key="fetch">
            <Content marginTop="size-200">
              <FetchProductPanel {...props} />
            </Content>
          </Item>
          <Item key="create">
            <Content marginTop="size-200">
              <CreateProductPanel {...props} />
            </Content>
          </Item>
          <Item key="update">
            <Content marginTop="size-200">
              <UpdateProductPanel {...props} />
            </Content>
          </Item>
        </TabPanels>
      </Tabs>
    </View>
  )
}
