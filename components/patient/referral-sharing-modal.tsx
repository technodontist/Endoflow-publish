"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  X,
  Share2,
  MessageCircle,
  Mail,
  Copy,
  Phone,
  Users,
  Gift,
  CheckCircle
} from "lucide-react"

interface ReferralSharingModalProps {
  onClose: () => void
  patientName: string
}

export function ReferralSharingModal({ onClose, patientName }: ReferralSharingModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<string>("")
  const [recipientName, setRecipientName] = useState("")
  const [recipientContact, setRecipientContact] = useState("")
  const [customMessage, setCustomMessage] = useState("")
  const [isSharing, setIsSharing] = useState(false)
  const [shareSuccess, setShareSuccess] = useState(false)

  // Generate unique referral code (in real implementation, this would come from the server)
  const referralCode = `REF-${patientName.split(' ')[0].toUpperCase()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`

  const referralLink = `https://endoflow.com/signup?ref=${referralCode}`

  const defaultMessage = `Hi! I've been using ENDOFLOW for my dental care and thought you might be interested. They provide excellent dental services with modern technology. Check them out: ${referralLink}`

  const sharingMethods = [
    {
      id: "whatsapp",
      name: "WhatsApp",
      icon: MessageCircle,
      color: "bg-green-500",
      action: () => {
        const message = encodeURIComponent(customMessage || defaultMessage)
        const phone = recipientContact.replace(/\D/g, '')
        window.open(`https://wa.me/${phone}?text=${message}`, '_blank')
      }
    },
    {
      id: "sms",
      name: "SMS",
      icon: Phone,
      color: "bg-blue-500",
      action: () => {
        const message = encodeURIComponent(customMessage || defaultMessage)
        window.open(`sms:${recipientContact}?body=${message}`, '_blank')
      }
    },
    {
      id: "email",
      name: "Email",
      icon: Mail,
      color: "bg-purple-500",
      action: () => {
        const subject = encodeURIComponent("Check out ENDOFLOW - Modern Dental Care")
        const body = encodeURIComponent(customMessage || defaultMessage)
        window.open(`mailto:${recipientContact}?subject=${subject}&body=${body}`, '_blank')
      }
    },
    {
      id: "link",
      name: "Copy Link",
      icon: Copy,
      color: "bg-gray-500",
      action: () => {
        navigator.clipboard.writeText(referralLink)
        // Show toast or alert
        alert("Referral link copied to clipboard!")
      }
    }
  ]

  const handleShare = async () => {
    if (!selectedMethod || !recipientContact) {
      alert("Please select a sharing method and enter recipient contact")
      return
    }

    setIsSharing(true)

    try {
      // Find the selected method and execute its action
      const method = sharingMethods.find(m => m.id === selectedMethod)
      if (method) {
        method.action()

        // Here you would also save the referral to the database
        // await createReferralAction({
        //   sharedVia: selectedMethod,
        //   recipientContact,
        //   recipientName,
        //   customMessage: customMessage || defaultMessage
        // })

        setShareSuccess(true)
        setTimeout(() => {
          onClose()
        }, 2000)
      }
    } catch (error) {
      console.error("Error sharing referral:", error)
      alert("Failed to share referral. Please try again.")
    } finally {
      setIsSharing(false)
    }
  }

  if (shareSuccess) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white/95 backdrop-blur-sm border-teal-200">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2 text-teal-800">Referral Shared!</h3>
            <p className="text-teal-600 mb-4">
              Your referral has been shared successfully. We'll let you know when your friend signs up!
            </p>
            <div className="bg-teal-50 p-3 rounded-lg border border-teal-200">
              <p className="text-sm text-teal-700">
                <Gift className="w-4 h-4 inline mr-1" />
                You'll earn rewards when they join!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-sm border-teal-200">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-teal-800 flex items-center gap-2">
              <Share2 className="w-5 h-5 text-teal-600" />
              Share ENDOFLOW
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose} className="hover:bg-teal-50">
              <X className="w-4 h-4 text-teal-600" />
            </Button>
          </div>
          <p className="text-sm text-teal-600">
            Help your friends & family discover quality dental care
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Referral Benefits */}
          <div className="bg-gradient-to-r from-teal-50 to-cyan-50 p-4 rounded-lg border border-teal-200">
            <div className="flex items-center gap-2 mb-2">
              <Gift className="w-5 h-5 text-teal-600" />
              <h4 className="font-semibold text-teal-800">Referral Benefits</h4>
            </div>
            <ul className="text-sm text-teal-700 space-y-1">
              <li>• You get rewards when friends join</li>
              <li>• They get a special welcome discount</li>
              <li>• Help them discover quality dental care</li>
            </ul>
          </div>

          {/* Recipient Information */}
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-teal-700 mb-2 block">
                Friend's Name (Optional)
              </Label>
              <Input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Enter your friend's name"
                className="border-teal-200 focus:border-teal-400"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-teal-700 mb-2 block">
                Contact Information *
              </Label>
              <Input
                value={recipientContact}
                onChange={(e) => setRecipientContact(e.target.value)}
                placeholder="Phone number or email address"
                className="border-teal-200 focus:border-teal-400"
              />
            </div>
          </div>

          {/* Sharing Methods */}
          <div>
            <Label className="text-sm font-medium text-teal-700 mb-3 block">
              How would you like to share?
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {sharingMethods.map((method) => {
                const Icon = method.icon
                return (
                  <Button
                    key={method.id}
                    variant={selectedMethod === method.id ? "default" : "outline"}
                    className={`h-16 flex-col gap-2 ${
                      selectedMethod === method.id
                        ? "bg-teal-600 hover:bg-teal-700 text-white"
                        : "border-teal-200 text-teal-700 hover:bg-teal-50"
                    }`}
                    onClick={() => setSelectedMethod(method.id)}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs">{method.name}</span>
                  </Button>
                )
              })}
            </div>
          </div>

          {/* Custom Message */}
          <div>
            <Label className="text-sm font-medium text-teal-700 mb-2 block">
              Personal Message (Optional)
            </Label>
            <Textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder={defaultMessage}
              rows={4}
              className="border-teal-200 focus:border-teal-400 placeholder:text-teal-400"
            />
          </div>

          {/* Your Referral Link */}
          <div className="bg-teal-50 p-4 rounded-lg border border-teal-200">
            <Label className="text-sm font-medium text-teal-700 mb-2 block">
              Your Referral Link
            </Label>
            <div className="flex gap-2">
              <Input
                value={referralLink}
                readOnly
                className="bg-white border-teal-200 text-teal-700 text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(referralLink)
                  alert("Link copied!")
                }}
                className="border-teal-200 text-teal-700 hover:bg-teal-50"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Share Button */}
          <Button
            onClick={handleShare}
            disabled={!selectedMethod || !recipientContact || isSharing}
            className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50"
          >
            {isSharing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Sharing...
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 mr-2" />
                Share ENDOFLOW
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}